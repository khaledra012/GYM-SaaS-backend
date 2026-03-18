import { Op } from "sequelize";
import sequelize from "../../config/db.config";
import {
  AppError,
  getCurrentDateOnlyInTimezone,
  normalizeTimezone,
} from "../../shared";
import { staffReadFacade } from "../staff/staff.facade";
import { getShiftTotals } from "./accounting-aggregates.util";
import { lockCenterRow } from "./center-lock.util";
import { centsToMoneyString, moneyToCents, toMoneyString } from "./money.util";
import Shift from "./shift.model";
import {
  buildClosedShiftWhere,
  buildOpenShiftWhere,
  resolveEffectiveShiftStatus,
} from "./shift-status.util";

export interface IShiftSnapshot {
  id: number;
  centerId: number;
  status: "open" | "closed";
  localDate: string;
  startingCash: string;
  expectedEndingCash: string;
  actualEndingCash: string | null;
  discrepancy: string | null;
  openedAt: Date;
  closedAt: Date | null;
  openedBy: number;
  openedByStaffId: number | null;
  openedByName: string;
  closedBy: number | null;
  closedByStaffId: number | null;
  closedByName: string | null;
  totals: {
    totalIn: string;
    totalOut: string;
    net: string;
  };
  currentExpectedCash: string;
}

interface IOpenShiftInput {
  centerId: number;
  openedBy: number;
  openedByStaffId?: number | null;
  startingCash: number;
  centerTimezone?: string;
  centerName?: string;
}

interface ICloseShiftInput {
  centerId: number;
  closedBy: number;
  closedByStaffId?: number | null;
  actualEndingCash: number;
  centerName?: string;
}

interface IListShiftsInput {
  centerId: number;
  status?: "open" | "closed";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
  centerName?: string;
}

class ShiftService {
  private getFallbackActorName(centerName?: string): string {
    return centerName?.trim() || "المالك";
  }

  private async getShiftStaffNames(centerId: number, shifts: Shift[]) {
    const staffIds = shifts
      .flatMap((shift) => [shift.openedByStaffId, shift.closedByStaffId])
      .filter((id): id is number => Number.isInteger(id) && Number(id) > 0);

    return staffReadFacade.getStaffNamesByIds(centerId, staffIds);
  }

  private mapShift(
    shift: Shift,
    totals: { totalIn: string; totalOut: string; net: string },
    staffNames: Map<number, string>,
    centerName?: string,
  ): IShiftSnapshot {
    const fallbackName = this.getFallbackActorName(centerName);

    const openedByName = shift.openedByStaffId
      ? staffNames.get(shift.openedByStaffId) ?? fallbackName
      : fallbackName;

    const closedByName =
      shift.closedBy === null
        ? null
        : shift.closedByStaffId
          ? staffNames.get(shift.closedByStaffId) ?? fallbackName
          : fallbackName;

    const currentExpectedCash = centsToMoneyString(
      moneyToCents(shift.startingCash) +
        moneyToCents(totals.totalIn) -
        moneyToCents(totals.totalOut),
    );

    return {
      id: shift.id,
      centerId: shift.centerId,
      status: resolveEffectiveShiftStatus(shift),
      localDate: shift.localDate,
      startingCash: shift.startingCash,
      expectedEndingCash: shift.expectedEndingCash,
      actualEndingCash: shift.actualEndingCash,
      discrepancy: shift.discrepancy,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openedBy: shift.openedBy,
      openedByStaffId: shift.openedByStaffId,
      openedByName,
      closedBy: shift.closedBy,
      closedByStaffId: shift.closedByStaffId,
      closedByName,
      totals,
      currentExpectedCash,
    };
  }

  public async openShift(input: IOpenShiftInput): Promise<IShiftSnapshot> {
    return sequelize.transaction(async (transaction) => {
      await lockCenterRow(input.centerId, transaction);

      const existingOpenShift = await Shift.findOne({
        where: buildOpenShiftWhere(input.centerId),
        lock: true,
        transaction,
      });

      if (existingOpenShift) {
        throw new AppError("يوجد وردية مفتوحة بالفعل لهذا المركز", 400);
      }

      const now = new Date();
      const timezone = normalizeTimezone(input.centerTimezone);
      const localDate = getCurrentDateOnlyInTimezone(timezone);
      const startingCash = toMoneyString(input.startingCash);

      const shift = await Shift.create(
        {
          centerId: input.centerId,
          status: "open",
          localDate,
          startingCash,
          expectedEndingCash: startingCash,
          actualEndingCash: null,
          discrepancy: null,
          openedAt: now,
          closedAt: null,
          openedBy: input.openedBy,
          openedByStaffId: input.openedByStaffId ?? null,
          closedBy: null,
          closedByStaffId: null,
        },
        { transaction },
      );

      const staffNames = await this.getShiftStaffNames(input.centerId, [shift]);

      return this.mapShift(
        shift,
        {
          totalIn: "0.00",
          totalOut: "0.00",
          net: "0.00",
        },
        staffNames,
        input.centerName,
      );
    });
  }

  public async listShifts(input: IListShiftsInput) {
    const whereClause: any =
      input.status === "open"
        ? buildOpenShiftWhere(input.centerId)
        : input.status === "closed"
          ? buildClosedShiftWhere(input.centerId)
          : { centerId: input.centerId };

    if (input.date) {
      whereClause.localDate = input.date;
    } else if (input.dateFrom || input.dateTo) {
      if (input.dateFrom && input.dateTo) {
        whereClause.localDate = { [Op.between]: [input.dateFrom, input.dateTo] };
      } else if (input.dateFrom) {
        whereClause.localDate = { [Op.gte]: input.dateFrom };
      } else if (input.dateTo) {
        whereClause.localDate = { [Op.lte]: input.dateTo };
      }
    }

    const offset = (input.page - 1) * input.limit;

    const { rows, count } = await Shift.findAndCountAll({
      where: whereClause,
      order: [["openedAt", "DESC"]],
      limit: input.limit,
      offset,
    });

    const staffNames = await this.getShiftStaffNames(input.centerId, rows);

    const data = await Promise.all(
      rows.map(async (shift, index) => {
        const totals = await getShiftTotals(input.centerId, shift.id);
        return {
          ...this.mapShift(shift, totals, staffNames, input.centerName),
          displayNumber: offset + index + 1,
        };
      }),
    );

    return {
      total: count,
      page: input.page,
      limit: input.limit,
      totalPages: Math.ceil(count / input.limit),
      data,
    };
  }

  public async getCurrentShift(
    centerId: number,
    centerName?: string,
  ): Promise<IShiftSnapshot | null> {
    const shift = await Shift.findOne({
      where: buildOpenShiftWhere(centerId),
      order: [["openedAt", "DESC"]],
    });

    if (!shift) return null;

    const totals = await getShiftTotals(centerId, shift.id);
    const staffNames = await this.getShiftStaffNames(centerId, [shift]);
    return this.mapShift(shift, totals, staffNames, centerName);
  }

  public async closeShift(input: ICloseShiftInput): Promise<IShiftSnapshot> {
    return sequelize.transaction(async (transaction) => {
      await lockCenterRow(input.centerId, transaction);

      const shift = await Shift.findOne({
        where: buildOpenShiftWhere(input.centerId),
        lock: true,
        transaction,
      });

      if (!shift) {
        throw new AppError("لا يوجد وردية مفتوحة لإغلاقها", 400);
      }

      const totals = await getShiftTotals(input.centerId, shift.id, transaction);

      const expectedEndingCashCents =
        moneyToCents(shift.startingCash) +
        moneyToCents(totals.totalIn) -
        moneyToCents(totals.totalOut);

      const actualEndingCash = toMoneyString(input.actualEndingCash);
      const discrepancyCents =
        moneyToCents(actualEndingCash) - expectedEndingCashCents;

      shift.status = "closed";
      shift.expectedEndingCash = centsToMoneyString(expectedEndingCashCents);
      shift.actualEndingCash = actualEndingCash;
      shift.discrepancy = centsToMoneyString(discrepancyCents);
      shift.closedAt = new Date();
      shift.closedBy = input.closedBy;
      shift.closedByStaffId = input.closedByStaffId ?? null;

      await shift.save({ transaction });

      const staffNames = await this.getShiftStaffNames(input.centerId, [shift]);

      return this.mapShift(shift, totals, staffNames, input.centerName);
    });
  }
}

export const shiftService = new ShiftService();
