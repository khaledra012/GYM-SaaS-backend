import { Response } from "express";
import { AuthRequest, catchAsync } from "../../shared";
import { debtService } from "./debt.service";
import {
  ICreateDebtDTO,
  ICreateDebtPaymentDTO,
  IDebtsSummaryQuery,
  IListDebtsQuery,
  IMemberDebtsQuery,
} from "./debt.schema";

export const createDebt = catchAsync(async (req: AuthRequest, res: Response) => {
  const data = (req as any).validated.body as ICreateDebtDTO;

  const debt = await debtService.createManualDebt({
    ...data,
    centerId: req.center.id,
    createdBy: req.center.id,
    centerTimezone: req.center.timezone,
  });

  return res.status(201).json({
    status: "نجاح",
    message: "تم إنشاء المديونية بنجاح",
    data: debt,
  });
});

export const listDebts = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = (req as any).validated.query as IListDebtsQuery;
  const result = await debtService.listDebts({
    centerId: req.center.id,
    query,
  });

  return res.status(200).json({
    status: "نجاح",
    ...result,
  });
});

export const getSummary = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = (req as any).validated.query as IDebtsSummaryQuery;
  const summary = await debtService.getSummary(req.center.id, query);

  return res.status(200).json({
    status: "نجاح",
    data: summary,
  });
});

export const getDebtById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const debt = await debtService.getDebtById(id, req.center.id);

  return res.status(200).json({
    status: "نجاح",
    data: debt,
  });
});

export const createDebtPayment = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const data = (req as any).validated.body as ICreateDebtPaymentDTO;

    const result = await debtService.createDebtPayment(id, req.center.id, {
      ...data,
      createdBy: req.center.id,
      centerTimezone: req.center.timezone,
    });

    return res.status(201).json({
      status: "نجاح",
      message: "تم تسجيل السداد بنجاح",
      data: result,
    });
  },
);

export const listMemberDebts = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { memberId } = (req as any).validated.params as { memberId: number };
    const query = (req as any).validated.query as IMemberDebtsQuery;

    const result = await debtService.listMemberDebts(
      memberId,
      req.center.id,
      query,
    );

    return res.status(200).json({
      status: "نجاح",
      ...result,
    });
  },
);

export const getMemberSummary = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { memberId } = (req as any).validated.params as { memberId: number };
    const summary = await debtService.getMemberDebtSummary(memberId, req.center.id);

    return res.status(200).json({
      status: "نجاح",
      data: summary,
    });
  },
);
