import Shift from "./shift.model";
import {
  getCurrentDateOnlyInTimezone,
  normalizeTimezone,
} from "../../shared";
import {
  getCenterLocalDateRangeTotals,
  getCenterLocalDateTotals,
  getShiftTotals,
} from "./accounting-aggregates.util";
import { centsToMoneyString, moneyToCents } from "./money.util";
import { debtReadFacade } from "../debts/debt.facade";
import { logger } from "../../shared";
import { buildOpenShiftWhere } from "./shift-status.util";

interface IFinancialSummaryInput {
  centerId: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  centerTimezone?: string;
}

class DashboardService {
  private mapPeriodTotals(totals: {
    totalIn: string;
    totalOut: string;
    net: string;
  }) {
    return {
      // New naming used by dashboard cards
      income: totals.totalIn,
      expenses: totals.totalOut,
      netProfit: totals.net,
      // Backward-compatible aliases for older frontend contracts
      totalIn: totals.totalIn,
      totalOut: totals.totalOut,
      net: totals.net,
    };
  }

  private async getSafeDebtSummary(centerId: number) {
    try {
      return await debtReadFacade.getCenterDebtSummary(centerId);
    } catch (error) {
      logger.error("تعذر تحميل ملخص المديونيات وسيتم تجاهله مؤقتًا", {
        centerId,
        error: String(error),
      });

      return {
        totalOriginalAmountCents: 0,
        totalPaidAmountCents: 0,
        totalRemainingAmountCents: 0,
        totalOriginalAmount: "0.00",
        totalPaidAmount: "0.00",
        totalRemainingAmount: "0.00",
        unpaidCount: 0,
        partiallyPaidCount: 0,
        paidCount: 0,
        outstandingDebtsCount: 0,
        membersWithOutstandingDebtsCount: 0,
      };
    }
  }

  public async getFinancialSummary(input: IFinancialSummaryInput) {
    const timezone = normalizeTimezone(input.centerTimezone);
    const todayLocalDate = getCurrentDateOnlyInTimezone(timezone);

    let resolvedDateFrom: string;
    let resolvedDateTo: string;

    if (input.date) {
      resolvedDateFrom = input.date;
      resolvedDateTo = input.date;
    } else if (input.dateFrom || input.dateTo) {
      resolvedDateFrom = input.dateFrom ?? (input.dateTo as string);
      resolvedDateTo = input.dateTo ?? (input.dateFrom as string);
    } else {
      resolvedDateFrom = todayLocalDate;
      resolvedDateTo = todayLocalDate;
    }

    const periodType =
      resolvedDateFrom === resolvedDateTo ? "single_day" : "range";

    const periodTotals =
      resolvedDateFrom === resolvedDateTo
        ? await getCenterLocalDateTotals(input.centerId, resolvedDateFrom)
        : await getCenterLocalDateRangeTotals(
            input.centerId,
            resolvedDateFrom,
            resolvedDateTo,
          );
    const mappedTotals = this.mapPeriodTotals(periodTotals);

    const openShift = await Shift.findOne({
      where: buildOpenShiftWhere(input.centerId),
      order: [["openedAt", "DESC"]],
    });

    if (!openShift) {
      const debtsSummary = await this.getSafeDebtSummary(input.centerId);

      return {
        localDate: resolvedDateFrom,
        dateFrom: resolvedDateFrom,
        dateTo: resolvedDateTo,
        periodType,
        ...mappedTotals,
        currentDrawerCash: null,
        hasOpenShift: false,
        currentShift: null,
        debtsSummary,
      };
    }

    const shiftTotals = await getShiftTotals(input.centerId, openShift.id);
    const currentDrawerCashCents =
      moneyToCents(openShift.startingCash) +
      moneyToCents(shiftTotals.totalIn) -
      moneyToCents(shiftTotals.totalOut);
    const debtsSummary = await this.getSafeDebtSummary(input.centerId);

    return {
      localDate: resolvedDateFrom,
      dateFrom: resolvedDateFrom,
      dateTo: resolvedDateTo,
      periodType,
      ...mappedTotals,
      currentDrawerCash: centsToMoneyString(currentDrawerCashCents),
      hasOpenShift: true,
      debtsSummary,
      currentShift: {
        id: openShift.id,
        localDate: openShift.localDate,
        openedAt: openShift.openedAt,
        startingCash: openShift.startingCash,
        totalIn: shiftTotals.totalIn,
        totalOut: shiftTotals.totalOut,
        net: shiftTotals.net,
      },
    };
  }

  public maskFinancialSummary(summary: any) {
    return {
      ...summary,
      canViewFinancials: false,
      income: null,
      expenses: null,
      netProfit: null,
      totalIn: null,
      totalOut: null,
      net: null,
      currentDrawerCash: null,
      debtsSummary: summary.debtsSummary
        ? {
            ...summary.debtsSummary,
            totalOriginalAmountCents: null,
            totalPaidAmountCents: null,
            totalRemainingAmountCents: null,
            totalOriginalAmount: null,
            totalPaidAmount: null,
            totalRemainingAmount: null,
            unpaidCount: null,
            partiallyPaidCount: null,
            paidCount: null,
            outstandingDebtsCount: null,
            membersWithOutstandingDebtsCount: null,
          }
        : null,
      currentShift: summary.currentShift
        ? {
            ...summary.currentShift,
            startingCash: null,
            totalIn: null,
            totalOut: null,
            net: null,
          }
        : null,
    };
  }
}

export const dashboardService = new DashboardService();
