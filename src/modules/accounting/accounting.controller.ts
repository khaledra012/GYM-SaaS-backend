import { Response } from "express";
import { AuthRequest, catchAsync } from "../../shared";
import {
  ICloseShiftDTO,
  ICreateTransactionDTO,
  IDashboardSummaryQuery,
  IListShiftsQuery,
  IListTransactionsQuery,
  IOpenShiftDTO,
} from "./accounting.schema";
import { shiftService } from "./shift.service";
import { accountingTransactionService } from "./transaction.service";
import { dashboardService } from "./dashboard.service";

export const openShift = catchAsync(async (req: AuthRequest, res: Response) => {
  const body = (req as any).validated.body as IOpenShiftDTO;

  const shift = await shiftService.openShift({
    centerId: req.center.id,
    openedBy: req.center.id,
    openedByStaffId: req.actor.type === "staff" ? req.actor.id : null,
    startingCash: body.startingCash,
    centerTimezone: req.center.timezone,
    centerName: req.center.name,
  });

  return res.status(201).json({
    status: "نجاح",
    message: "تم فتح الوردية بنجاح",
    data: shift,
  });
});

export const closeShift = catchAsync(async (req: AuthRequest, res: Response) => {
  const body = (req as any).validated.body as ICloseShiftDTO;

  const shift = await shiftService.closeShift({
    centerId: req.center.id,
    closedBy: req.center.id,
    closedByStaffId: req.actor.type === "staff" ? req.actor.id : null,
    actualEndingCash: body.actualEndingCash,
    centerName: req.center.name,
  });

  return res.status(200).json({
    status: "نجاح",
    message: "تم إغلاق الوردية بنجاح",
    data: shift,
  });
});

export const getShifts = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = (req as any).validated.query as IListShiftsQuery;

  const result = await shiftService.listShifts({
    centerId: req.center.id,
    status: query.status,
    date: query.date,
    dateFrom: query.dateFrom ?? query.startDate,
    dateTo: query.dateTo ?? query.endDate,
    page: query.page,
    limit: query.limit,
    centerName: req.center.name,
  });

  return res.status(200).json({
    status: "نجاح",
    ...result,
  });
});

export const getCurrentShift = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const shift = await shiftService.getCurrentShift(
      req.center.id,
      req.center.name,
    );

    return res.status(200).json({
      status: "نجاح",
      data: shift,
    });
  },
);

export const createManualTransaction = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const body = (req as any).validated.body as ICreateTransactionDTO;

    const transaction = await accountingTransactionService.createManualTransaction(
      {
        centerId: req.center.id,
        createdBy: req.center.id,
        type: body.type,
        amount: body.amount,
        category: body.category,
        description: body.description,
        occurredAt: body.occurredAt,
        centerTimezone: req.center.timezone,
      },
    );

    return res.status(201).json({
      status: "نجاح",
      message: "تم تسجيل الحركة بنجاح",
      data: transaction,
    });
  },
);

export const getTransactionsLedger = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const query = (req as any).validated.query as IListTransactionsQuery;

    const result = await accountingTransactionService.getTransactionsLedger(
      req.center.id,
      {
        date: query.date,
        dateFrom: query.dateFrom ?? query.startDate,
        dateTo: query.dateTo ?? query.endDate,
        type: query.type,
        category: query.category,
        shiftId: query.shiftId,
        page: query.page,
        limit: query.limit,
        centerTimezone: req.center.timezone,
      },
    );

    return res.status(200).json({
      status: "نجاح",
      ...result,
    });
  },
);

export const getDashboardSummary = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const query = (req as any).validated.query as IDashboardSummaryQuery;

    const rawSummary = await dashboardService.getFinancialSummary({
      centerId: req.center.id,
      date: query.date,
      dateFrom: query.dateFrom ?? query.startDate,
      dateTo: query.dateTo ?? query.endDate,
      centerTimezone: req.center.timezone,
    });

    const summary =
      req.actor.role === "receptionist"
        ? dashboardService.maskFinancialSummary(rawSummary)
        : {
            ...rawSummary,
            canViewFinancials: true,
          };

    return res.status(200).json({
      status: "نجاح",
      data: summary,
    });
  },
);
