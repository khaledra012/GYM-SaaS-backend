import { Request, Response } from "express";
import { catchAsync } from "../../shared";
import {
  IActivateCenterDTO,
  IPlatformAdminLoginDTO,
  IListPlatformCentersQuery,
  IUpdateCenterBillingStatusDTO,
  IUpdateCenterBillingStatusParams,
} from "./platform-admin.schema";
import { platformAdminService } from "./platform-admin.service";

export const login = catchAsync(async (req: Request, res: Response) => {
  const body = (req as any).validated.body as IPlatformAdminLoginDTO;

  const result = await platformAdminService.login(body);

  return res.status(200).json({
    status: "نجاح",
    message: "تم تسجيل دخول المشرف بنجاح",
    data: result,
  });
});

export const getDashboardSummary = catchAsync(
  async (_req: Request, res: Response) => {
    const data = await platformAdminService.getDashboardSummary();

    return res.status(200).json({
      status: "نجاح",
      data,
    });
  },
);

export const listCenters = catchAsync(async (req: Request, res: Response) => {
  const query = (req as any).validated.query as IListPlatformCentersQuery;

  const result = await platformAdminService.listCenters({
    page: query.page,
    limit: query.limit,
    billingStatus: query.billingStatus,
    search: query.search,
  });

  return res.status(200).json({
    status: "نجاح",
    ...result,
  });
});

export const updateCenterBillingStatus = catchAsync(
  async (req: Request, res: Response) => {
    const params = (req as any).validated.params as IUpdateCenterBillingStatusParams;
    const body = (req as any).validated.body as IUpdateCenterBillingStatusDTO;

    const center = await platformAdminService.updateCenterBillingStatus({
      centerId: params.centerId,
      billingStatus: body.billingStatus,
      trialEndsAt: body.trialEndsAt ? new Date(body.trialEndsAt) : undefined,
      subscriptionEndsAt: body.subscriptionEndsAt
        ? new Date(body.subscriptionEndsAt)
        : undefined,
      subscriptionDurationDays: body.subscriptionDurationDays,
    });

    return res.status(200).json({
      status: "نجاح",
      message: "تم تحديث حالة الجيم بنجاح",
      data: center,
    });
  },
);

export const activateCenter = catchAsync(async (req: Request, res: Response) => {
  const params = (req as any).validated.params as IUpdateCenterBillingStatusParams;
  const body = (req as any).validated.body as IActivateCenterDTO;

  const center = await platformAdminService.activateCenter(params.centerId, {
    subscriptionEndsAt: body.subscriptionEndsAt
      ? new Date(body.subscriptionEndsAt)
      : undefined,
    subscriptionDurationDays: body.subscriptionDurationDays,
  });

  return res.status(200).json({
    status: "نجاح",
    message: "تم تفعيل الجيم بنجاح",
    data: center,
  });
});

export const deactivateCenter = catchAsync(async (req: Request, res: Response) => {
  const params = (req as any).validated.params as IUpdateCenterBillingStatusParams;

  const center = await platformAdminService.deactivateCenter(params.centerId);

  return res.status(200).json({
    status: "نجاح",
    message: "تم إيقاف الجيم بنجاح",
    data: center,
  });
});
