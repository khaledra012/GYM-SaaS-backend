import { Op } from "sequelize";
import sequelize from "../../config/db.config";
import {
  AppError,
  getCurrentDateOnlyInTimezone,
  getDateOnlyInTimezone,
  normalizeTimezone,
} from "../../shared";
import AccountingTransaction, {
  AccountingTransactionCategory,
  AccountingTransactionType,
} from "./accounting-transaction.model";
import Shift from "./shift.model";
import {
  getCenterLocalDateRangeTotals,
  getCenterLocalDateTotals,
} from "./accounting-aggregates.util";
import { lockCenterRow } from "./center-lock.util";
import { toMoneyString } from "./money.util";

interface ICreateManualTransactionInput {
  centerId: number;
  createdBy: number;
  type: AccountingTransactionType;
  amount: number;
  category: AccountingTransactionCategory;
  description?: string;
  occurredAt?: string;
  centerTimezone?: string;
}

interface IListTransactionsQuery {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: AccountingTransactionType;
  category?: AccountingTransactionCategory;
  shiftId?: number;
  page: number;
  limit: number;
  centerTimezone?: string;
}

class AccountingTransactionService {
  public async createManualTransaction(
    input: ICreateManualTransactionInput,
  ): Promise<AccountingTransaction> {
    return sequelize.transaction(async (transaction) => {
      await lockCenterRow(input.centerId, transaction);

      const openShift = await Shift.findOne({
        where: { centerId: input.centerId, status: "open" },
        lock: true,
        transaction,
      });

      if (!openShift) {
        throw new AppError("لا يوجد وردية مفتوحة. افتح وردية أولاً قبل تسجيل أي حركة", 400);
      }

      const amount = toMoneyString(input.amount);
      if (amount === "0.00") {
        throw new AppError("قيمة المعاملة يجب أن تكون أكبر من صفر", 400);
      }

      let occurredAt = new Date();
      if (input.occurredAt) {
        const parsed = new Date(input.occurredAt);
        if (Number.isNaN(parsed.getTime())) {
          throw new AppError("تاريخ الحركة غير صالح", 400);
        }
        occurredAt = parsed;
      }

      const timezone = normalizeTimezone(input.centerTimezone);
      const localDate = getDateOnlyInTimezone(occurredAt, timezone);

      return AccountingTransaction.create(
        {
          centerId: input.centerId,
          shiftId: openShift.id,
          type: input.type,
          amount,
          category: input.category,
          description: input.description?.trim() || null,
          referenceType: null,
          referenceId: null,
          localDate,
          occurredAt,
          source: "manual",
          idempotencyKey: null,
          reversalOfTransactionId: null,
          createdBy: input.createdBy,
          metadata: {
            source: "manual_entry",
          },
        },
        { transaction },
      );
    });
  }

  public async getTransactionsLedger(centerId: number, query: IListTransactionsQuery) {
    const timezone = normalizeTimezone(query.centerTimezone);
    const todayLocalDate = getCurrentDateOnlyInTimezone(timezone);

    let resolvedDateFrom: string;
    let resolvedDateTo: string;

    if (query.date) {
      resolvedDateFrom = query.date;
      resolvedDateTo = query.date;
    } else if (query.dateFrom || query.dateTo) {
      resolvedDateFrom = query.dateFrom ?? (query.dateTo as string);
      resolvedDateTo = query.dateTo ?? (query.dateFrom as string);
    } else {
      resolvedDateFrom = todayLocalDate;
      resolvedDateTo = todayLocalDate;
    }

    const whereCondition: any = {
      centerId,
    };

    if (resolvedDateFrom === resolvedDateTo) {
      whereCondition.localDate = resolvedDateFrom;
    } else {
      whereCondition.localDate = {
        [Op.between]: [resolvedDateFrom, resolvedDateTo],
      };
    }

    if (query.type) {
      whereCondition.type = query.type;
    }

    if (query.category) {
      whereCondition.category = query.category;
    }

    if (query.shiftId) {
      whereCondition.shiftId = query.shiftId;
    }

    const offset = (query.page - 1) * query.limit;

    const { rows, count } = await AccountingTransaction.findAndCountAll({
      where: whereCondition,
      include: [
        {
          association: "shift",
          attributes: ["id", "status", "localDate", "openedAt", "closedAt"],
          required: false,
        },
      ],
      order: [
        ["occurredAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: query.limit,
      offset,
      distinct: true,
    });

    const summaryTotals =
      resolvedDateFrom === resolvedDateTo
        ? await getCenterLocalDateTotals(centerId, resolvedDateFrom)
        : await getCenterLocalDateRangeTotals(
            centerId,
            resolvedDateFrom,
            resolvedDateTo,
          );

    const data = rows.map((row, index) => {
      const item = row.toJSON() as any;
      return {
        id: item.id,
        displayNumber: offset + index + 1,
        type: item.type,
        amount: item.amount,
        category: item.category,
        description: item.description,
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        source: item.source,
        localDate: item.localDate,
        occurredAt: item.occurredAt,
        createdBy: item.createdBy,
        shift: item.shift
          ? {
              id: item.shift.id,
              status: item.shift.status,
              localDate: item.shift.localDate,
              openedAt: item.shift.openedAt,
              closedAt: item.shift.closedAt,
            }
          : null,
      };
    });

    return {
      localDate: resolvedDateFrom,
      dateFrom: resolvedDateFrom,
      dateTo: resolvedDateTo,
      periodType: resolvedDateFrom === resolvedDateTo ? "single_day" : "range",
      summary: summaryTotals,
      total: count,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(count / query.limit),
      data,
    };
  }
}

export const accountingTransactionService = new AccountingTransactionService();
