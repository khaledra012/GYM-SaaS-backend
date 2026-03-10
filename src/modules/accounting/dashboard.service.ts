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

interface IFinancialSummaryInput {
  centerId: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  centerTimezone?: string;
}

class DashboardService {
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

    const openShift = await Shift.findOne({
      where: {
        centerId: input.centerId,
        status: "open",
      },
      order: [["openedAt", "DESC"]],
    });

    if (!openShift) {
      return {
        localDate: resolvedDateFrom,
        dateFrom: resolvedDateFrom,
        dateTo: resolvedDateTo,
        periodType,
        income: periodTotals.totalIn,
        expenses: periodTotals.totalOut,
        netProfit: periodTotals.net,
        currentDrawerCash: null,
        hasOpenShift: false,
        currentShift: null,
      };
    }

    const shiftTotals = await getShiftTotals(input.centerId, openShift.id);
    const currentDrawerCashCents =
      moneyToCents(openShift.startingCash) +
      moneyToCents(shiftTotals.totalIn) -
      moneyToCents(shiftTotals.totalOut);

    return {
      localDate: resolvedDateFrom,
      dateFrom: resolvedDateFrom,
      dateTo: resolvedDateTo,
      periodType,
      income: periodTotals.totalIn,
      expenses: periodTotals.totalOut,
      netProfit: periodTotals.net,
      currentDrawerCash: centsToMoneyString(currentDrawerCashCents),
      hasOpenShift: true,
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
}

export const dashboardService = new DashboardService();
