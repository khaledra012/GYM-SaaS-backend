import { Response } from "express";
import { AuthRequest, catchAsync } from "../../shared";
import {
  ICreateWhatsAppCampaignDTO,
  ICreateWhatsAppTemplateDTO,
  IListWhatsAppCampaignsQuery,
  IListWhatsAppMessagesQuery,
  IPreviewWhatsAppCampaignDTO,
  ISendWhatsAppTestMessageDTO,
  IUpdateWhatsAppOptInDTO,
  IUpdateWhatsAppTemplateDTO,
} from "./whatsapp.schema";
import { whatsAppService } from "./whatsapp.service";

export const connectSession = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const result = await whatsAppService.connectSession(req.center.id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تم بدء جلسة واتساب بنجاح",
      data: result,
    });
  },
);

export const getSessionStatus = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const result = await whatsAppService.getStatus(req.center.id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      data: result,
    });
  },
);

export const disconnectSession = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const result = await whatsAppService.disconnectSession(req.center.id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تم فصل جلسة واتساب",
      data: result,
    });
  },
);

export const resumeModule = catchAsync(
  async (_req: AuthRequest, res: Response) => {
    const result = await whatsAppService.resumeModule();

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تمت إعادة تشغيل موديول الواتساب",
      data: result,
    });
  },
);

export const sendTestMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as ISendWhatsAppTestMessageDTO;
    const result = await whatsAppService.sendTestMessage(
      req.center.id,
      data.phone,
      data.message ?? `هذه رسالة اختبار من نظام ${req.center.name}.`,
      req.center.name,
    );

    return res.status(201).json({
      status: "نجاح",
      success: true,
      message: result.queued
        ? "تمت إضافة رسالة الاختبار إلى طابور الإرسال"
        : result.reason ?? "تعذر تجهيز رسالة الاختبار",
      data: result,
    });
  },
);

export const listMessages = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const query = (req as any).validated.query as IListWhatsAppMessagesQuery;
    const result = await whatsAppService.listMessages(req.center.id, query);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      data: {
        messages: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  },
);

export const listTemplates = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const result = await whatsAppService.listTemplates(req.center.id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      data: result,
    });
  },
);

export const createTemplate = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as ICreateWhatsAppTemplateDTO;
    const result = await whatsAppService.createTemplate(req.center.id, data);

    return res.status(201).json({
      status: "نجاح",
      success: true,
      message: "تم إنشاء قالب واتساب بنجاح",
      data: result,
    });
  },
);

export const updateTemplate = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const data = (req as any).validated.body as IUpdateWhatsAppTemplateDTO;
    const result = await whatsAppService.updateTemplate(req.center.id, id, data);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تم تحديث قالب واتساب بنجاح",
      data: result,
    });
  },
);

export const getMemberOptIn = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { memberId } = (req as any).validated.params as { memberId: number };
    const result = await whatsAppService.getMemberOptIn(req.center.id, memberId);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      data: result,
    });
  },
);

export const updateMemberOptIn = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { memberId } = (req as any).validated.params as { memberId: number };
    const data = (req as any).validated.body as IUpdateWhatsAppOptInDTO;
    const result = await whatsAppService.updateMemberOptIn(req.center.id, memberId, {
      ...data,
      updatedBy: req.actor?.id ?? req.center.id,
    });

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تم تحديث إذن واتساب للعضو",
      data: result,
    });
  },
);

export const previewCampaign = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as IPreviewWhatsAppCampaignDTO;
    const result = await whatsAppService.previewCampaign(req.center.id, data);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      data: result,
    });
  },
);

export const createCampaign = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const data = (req as any).validated.body as ICreateWhatsAppCampaignDTO;
    const result = await whatsAppService.createCampaign(
      req.center.id,
      req.actor?.id ?? req.center.id,
      req.center.name,
      data,
    );

    return res.status(201).json({
      status: "نجاح",
      success: true,
      message: "تم إنشاء حملة واتساب وإضافتها إلى طابور الإرسال",
      data: result,
    });
  },
);

export const listCampaigns = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const query = (req as any).validated.query as IListWhatsAppCampaignsQuery;
    const result = await whatsAppService.listCampaigns(req.center.id, query);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      data: {
        campaigns: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
    });
  },
);

export const getCampaignById = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const result = await whatsAppService.getCampaignById(req.center.id, id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      data: result,
    });
  },
);

export const pauseCampaign = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const result = await whatsAppService.pauseCampaign(req.center.id, id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تم إيقاف الحملة مؤقتًا",
      data: result,
    });
  },
);

export const resumeCampaign = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const result = await whatsAppService.resumeCampaign(req.center.id, id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تم استئناف الحملة",
      data: result,
    });
  },
);

export const cancelCampaign = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = (req as any).validated.params as { id: number };
    const result = await whatsAppService.cancelCampaign(req.center.id, id);

    return res.status(200).json({
      status: "نجاح",
      success: true,
      message: "تم إلغاء الحملة",
      data: result,
    });
  },
);
