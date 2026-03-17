import { Response } from "express";
import { AuthRequest, catchAsync } from "../../shared";
import {
  ICreateStaffDTO,
  IListStaffQuery,
  IResetStaffPasswordDTO,
  IStaffLoginDTO,
  IUpdateStaffDTO,
  IUpdateStaffStatusDTO,
} from "./staff.schema";
import { staffService } from "./staff.service";

export const login = catchAsync(async (req: AuthRequest, res: Response) => {
  const body = (req as any).validated.body as IStaffLoginDTO;
  const result = await staffService.login(body);

  return res.status(200).json({
    status: "نجاح",
    message: "تم تسجيل دخول الموظف بنجاح",
    data: result,
  });
});

export const getCurrentActor = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const actor = staffService.buildCurrentActor(req.center, req.actor);

    return res.status(200).json({
      status: "نجاح",
      data: actor,
    });
  },
);

export const listStaff = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = (req as any).validated.query as IListStaffQuery;
  const result = await staffService.listStaff(req.center.id, query);

  return res.status(200).json({
    status: "نجاح",
    ...result,
  });
});

export const createStaff = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const body = (req as any).validated.body as ICreateStaffDTO;
    const staff = await staffService.createStaff(req.center.id, body);

    return res.status(201).json({
      status: "نجاح",
      message: "تم إنشاء الموظف بنجاح",
      data: staff,
    });
  },
);

export const updateStaff = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const params = (req as any).validated.params as { id: number };
    const body = (req as any).validated.body as IUpdateStaffDTO;
    const staff = await staffService.updateStaff(req.center.id, params.id, body);

    return res.status(200).json({
      status: "نجاح",
      message: "تم تحديث بيانات الموظف بنجاح",
      data: staff,
    });
  },
);

export const updateStaffStatus = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const params = (req as any).validated.params as { id: number };
    const body = (req as any).validated.body as IUpdateStaffStatusDTO;
    const staff = await staffService.updateStaffStatus(
      req.center.id,
      params.id,
      body,
    );

    return res.status(200).json({
      status: "نجاح",
      message: "تم تحديث حالة الموظف بنجاح",
      data: staff,
    });
  },
);

export const resetStaffPassword = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const params = (req as any).validated.params as { id: number };
    const body = (req as any).validated.body as IResetStaffPasswordDTO;

    await staffService.resetStaffPassword(req.center.id, params.id, body.password);

    return res.status(200).json({
      status: "نجاح",
      message: "تم تغيير كلمة مرور الموظف بنجاح",
    });
  },
);

