import { Response } from "express";
import { AuthRequest, catchAsync } from "../../shared";
import {
  IGenerateAiPlanDTO,
  IRejectAiPlanDTO,
  IUpdateAiPlanDTO,
  IListMemberAiPlansQuery,
} from "./ai-plan.schema";
import { aiPlanService } from "./ai-plan.service";

export const generatePlan = catchAsync(async (req: AuthRequest, res: Response) => {
  const data = (req as any).validated.body as IGenerateAiPlanDTO;
  const result = await aiPlanService.generateDraft(
    req.center.id,
    req.actor?.id ?? req.center.id,
    data,
  );

  return res.status(201).json({
    status: "نجاح",
    message: "تم توليد مسودة الخطة بالذكاء الاصطناعي بنجاح",
    data: result,
  });
});

export const getPlanById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const result = await aiPlanService.getPlanById(req.center.id, id);

  return res.status(200).json({
    status: "نجاح",
    data: result,
  });
});

export const listMemberPlans = catchAsync(async (req: AuthRequest, res: Response) => {
  const { memberId } = (req as any).validated.params as { memberId: number };
  const query = (req as any).validated.query as IListMemberAiPlansQuery;
  const result = await aiPlanService.listMemberPlans(req.center.id, memberId, query);

  return res.status(200).json({
    status: "نجاح",
    data: result,
  });
});

export const updatePlan = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const data = (req as any).validated.body as IUpdateAiPlanDTO;
  const result = await aiPlanService.updatePlan(
    req.center.id,
    id,
    req.actor?.id ?? req.center.id,
    data.payload,
  );

  return res.status(200).json({
    status: "نجاح",
    message: "تم تحديث الخطة بنجاح",
    data: result,
  });
});

export const approvePlan = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const result = await aiPlanService.approvePlan(
    req.center.id,
    id,
    req.actor?.id ?? req.center.id,
  );

  return res.status(200).json({
    status: "نجاح",
    message: "تم اعتماد الخطة وتوليد ملف PDF",
    data: result,
  });
});

export const rejectPlan = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const data = (req as any).validated.body as IRejectAiPlanDTO;
  const result = await aiPlanService.rejectPlan(
    req.center.id,
    id,
    req.actor?.id ?? req.center.id,
    data.reason,
  );

  return res.status(200).json({
    status: "نجاح",
    message: "تم رفض الخطة",
    data: result,
  });
});

export const generatePdf = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const result = await aiPlanService.generatePdf(req.center.id, id);

  return res.status(200).json({
    status: "نجاح",
    message: "تم تجهيز ملف PDF للخطة",
    data: result,
  });
});

export const downloadPdf = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const result = await aiPlanService.getPdfDownload(req.center.id, id);
  return res.download(result.filePath, result.fileName);
});

export const sendPlanOnWhatsApp = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = (req as any).validated.params as { id: number };
  const result = await aiPlanService.sendPlanOnWhatsApp(
    req.center.id,
    id,
    req.actor?.id ?? req.center.id,
  );

  return res.status(200).json({
    status: "نجاح",
    message: "تمت إضافة ملف الخطة إلى طابور واتساب",
    data: result,
  });
});
