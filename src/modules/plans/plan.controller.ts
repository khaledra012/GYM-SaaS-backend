import { Response } from "express";
import { planService } from "./plan.service";
import { catchAsync, AuthRequest } from "../../shared";
import { ICreatePlanDTO, IUpdatePlanDTO } from "./plan.schema";

export const createPlan = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as ICreatePlanDTO;

    const plan = await planService.createPlan(data, req.center.id);

    return res.status(201).json({
      status: "نجاح",
      data: plan,
    });
  },
);

export const getAllPlans = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const plans = await planService.getAllPlans(req.center.id);

    return res.status(200).json({
      status: "نجاح",
      data: plans,
    });
  },
);

export const getPlanById = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    const plan = await planService.getPlanById(id, req.center.id);

    return res.status(200).json({
      status: "نجاح",
      data: plan,
    });
  },
);

export const updatePlan = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = req.validated.body as IUpdatePlanDTO;
    const { id } = (req as any).validated.params as { id: number };

    const plan = await planService.updatePlan(id, req.center.id, data);

    return res.status(200).json({
      status: "نجاح",
      data: plan,
    });
  },
);

export const deletePlan = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };

    await planService.deletePlan(id, req.center.id);

    return res.status(204).send();
  },
);


