import fs from "fs/promises";
import path from "path";
import { AppError, getDateOnlyInTimezone } from "../../shared";
import { authReadFacade } from "../auth";
import { memberReadFacade } from "../member";
import { whatsAppCommandFacade } from "../whatsapp";
import AiPlan from "./ai-plan.model";
import AiPlanDeliveryLog from "./ai-plan-delivery-log.model";
import AiPlanVersion from "./ai-plan-version.model";
import { IGenerateAiPlanDTO, IAiPlanPayload, AiPlanPayloadSchema, IListMemberAiPlansQuery } from "./ai-plan.schema";
import { aiPlanGeminiService } from "./ai-plan-gemini.service";
import { aiPlanPdfService } from "./ai-plan-pdf.service";
import { AiPlanStatus, AiPlanVersionSource } from "./ai-plan.types";
import { buildAiPlanRiskFlags } from "./ai-plan.util";

class AiPlanService {
  private mapPlan(plan: AiPlan) {
    const data = plan.toJSON() as any;

    return {
      id: data.id,
      centerId: data.centerId,
      memberId: data.memberId,
      planType: data.planType,
      status: data.status,
      goal: data.goal,
      inputSnapshot: data.inputSnapshot,
      aiOutput: data.aiOutput,
      coachEditedOutput: data.coachEditedOutput,
      activeOutput: data.coachEditedOutput ?? data.aiOutput,
      riskFlags: data.riskFlags ?? [],
      warnings: data.warnings ?? [],
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt,
      rejectedBy: data.rejectedBy,
      rejectedAt: data.rejectedAt,
      rejectionReason: data.rejectionReason,
      pdfPath: data.pdfPath,
      pdfFileName: data.pdfPath ? path.basename(data.pdfPath) : null,
      sentAt: data.sentAt,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      localDate: data.localDate,
      member: data.member
        ? {
            id: data.member.id,
            name: data.member.name,
            phone: data.member.phone,
            code: data.member.code,
            status: data.member.status,
          }
        : null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private async findPlanOrThrow(centerId: number, planId: number): Promise<AiPlan> {
    const plan = await AiPlan.findOne({
      where: {
        id: planId,
        centerId,
      },
      include: [
        {
          association: "member",
          attributes: ["id", "name", "phone", "code", "status"],
          required: false,
        },
      ],
    });

    if (!plan) {
      throw new AppError("الخطة المطلوبة غير موجودة", 404);
    }

    return plan;
  }

  private async createVersion(
    planId: number,
    createdBy: number,
    source: AiPlanVersionSource,
    payload: Record<string, unknown>,
  ) {
    const latestVersion = await AiPlanVersion.findOne({
      where: { planId },
      order: [["versionNumber", "DESC"]],
    });

    await AiPlanVersion.create({
      planId,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      source,
      payload,
      createdBy,
    });
  }

  private getActivePayload(plan: AiPlan): IAiPlanPayload {
    const candidate = plan.coachEditedOutput ?? plan.aiOutput;
    return AiPlanPayloadSchema.parse(candidate);
  }

  private buildReadableWarnings(riskFlags: string[], payloadWarnings: string[]): string[] {
    const warnings = new Set(payloadWarnings);

    if (riskFlags.includes("under_18")) {
      warnings.add("العمر أقل من 18 سنة ويجب مراجعة الخطة يدويًا بحذر.");
    }

    if (riskFlags.includes("medical_review_required")) {
      warnings.add("توجد حالة صحية أو إصابة تستلزم مراجعة بشرية دقيقة قبل الاعتماد.");
    }

    return Array.from(warnings);
  }

  private assertPlanEditable(status: AiPlanStatus) {
    if (!["draft", "reviewed"].includes(status)) {
      throw new AppError("لا يمكن تعديل هذه الخطة بعد حالتها الحالية", 400);
    }
  }

  private async ensurePdfPath(
    plan: AiPlan,
    centerName: string,
    memberName: string,
    memberCode: string,
  ): Promise<string> {
    if (plan.pdfPath) {
      try {
        await fs.access(plan.pdfPath);
        return plan.pdfPath;
      } catch {
        // regenerate below
      }
    }

    const payload = this.getActivePayload(plan);
    const pdfPath = await aiPlanPdfService.generate({
      planId: plan.id,
      centerId: plan.centerId,
      centerName,
      memberName,
      memberCode,
      goal: plan.goal,
      planType: plan.planType,
      payload,
    });

    plan.pdfPath = pdfPath;
    await plan.save();
    return pdfPath;
  }

  public async generateDraft(centerId: number, actorId: number, input: IGenerateAiPlanDTO) {
    const [center, member] = await Promise.all([
      authReadFacade.getCenterForAccess(centerId),
      memberReadFacade.findContactByIdInCenter(input.memberId, centerId),
    ]);

    if (!center || !member) {
      throw new AppError("تعذر العثور على بيانات المركز أو العضو", 404);
    }

    const riskFlags = buildAiPlanRiskFlags(input);
    const aiOutput = await aiPlanGeminiService.generatePlan(center.name, member.name, input);
    const warnings = this.buildReadableWarnings(riskFlags, aiOutput.warnings);
    const localDate = getDateOnlyInTimezone(new Date(), center.timezone);

    const plan = await AiPlan.create({
      centerId,
      memberId: member.id,
      planType: input.planType,
      goal: input.goal,
      inputSnapshot: input as unknown as Record<string, unknown>,
      aiOutput: {
        ...aiOutput,
        warnings,
      } as unknown as Record<string, unknown>,
      coachEditedOutput: null,
      riskFlags,
      warnings,
      createdBy: actorId,
      updatedBy: actorId,
      localDate,
    });

    await this.createVersion(plan.id, actorId, "ai_generated", {
      source: "ai",
      payload: plan.aiOutput,
    });

    return this.getPlanById(centerId, plan.id);
  }

  public async getPlanById(centerId: number, planId: number) {
    const plan = await this.findPlanOrThrow(centerId, planId);
    return this.mapPlan(plan);
  }

  public async listMemberPlans(
    centerId: number,
    memberId: number,
    query: IListMemberAiPlansQuery,
  ) {
    const member = await memberReadFacade.findContactByIdInCenter(memberId, centerId);
    if (!member) {
      throw new AppError("العضو المطلوب غير موجود", 404);
    }

    const where: any = {
      centerId,
      memberId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const plans = await AiPlan.findAll({
      where,
      include: [
        {
          association: "member",
          attributes: ["id", "name", "phone", "code", "status"],
          required: false,
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    return plans.map((plan) => this.mapPlan(plan));
  }

  public async updatePlan(
    centerId: number,
    planId: number,
    actorId: number,
    payload: IAiPlanPayload,
  ) {
    const plan = await this.findPlanOrThrow(centerId, planId);
    this.assertPlanEditable(plan.status);

    plan.coachEditedOutput = payload as unknown as Record<string, unknown>;
    plan.warnings = payload.warnings;
    plan.status = "reviewed";
    plan.updatedBy = actorId;
    plan.rejectionReason = null;
    plan.rejectedAt = null;
    plan.rejectedBy = null;
    await plan.save();

    await this.createVersion(plan.id, actorId, "coach_edited", {
      source: "coach",
      payload,
    });

    return this.getPlanById(centerId, planId);
  }

  public async approvePlan(centerId: number, planId: number, actorId: number) {
    const plan = await this.findPlanOrThrow(centerId, planId);
    if (["rejected", "archived"].includes(plan.status)) {
      throw new AppError("لا يمكن اعتماد هذه الخطة في حالتها الحالية", 400);
    }

    const member = await memberReadFacade.findContactByIdInCenter(plan.memberId, centerId);
    const center = await authReadFacade.getCenterForAccess(centerId);

    if (!member || !center) {
      throw new AppError("تعذر تجهيز بيانات الاعتماد للخطة", 404);
    }

    const activePayload = this.getActivePayload(plan);
    const pdfPath = await aiPlanPdfService.generate({
      planId: plan.id,
      centerId,
      centerName: center.name,
      memberName: member.name,
      memberCode: member.code,
      goal: plan.goal,
      planType: plan.planType,
      payload: activePayload,
    });

    plan.status = "approved";
    plan.pdfPath = pdfPath;
    plan.approvedBy = actorId;
    plan.approvedAt = new Date();
    plan.updatedBy = actorId;
    plan.rejectedAt = null;
    plan.rejectedBy = null;
    plan.rejectionReason = null;
    await plan.save();

    await this.createVersion(plan.id, actorId, "approved_snapshot", {
      source: "approved",
      payload: activePayload,
      pdfPath,
    });

    return this.getPlanById(centerId, planId);
  }

  public async rejectPlan(
    centerId: number,
    planId: number,
    actorId: number,
    reason: string,
  ) {
    const plan = await this.findPlanOrThrow(centerId, planId);
    if (["approved", "sent_whatsapp", "archived"].includes(plan.status)) {
      throw new AppError("لا يمكن رفض هذه الخطة في حالتها الحالية", 400);
    }

    plan.status = "rejected";
    plan.rejectedBy = actorId;
    plan.rejectedAt = new Date();
    plan.rejectionReason = reason;
    plan.updatedBy = actorId;
    await plan.save();

    await this.createVersion(plan.id, actorId, "rejected_snapshot", {
      source: "rejected",
      reason,
      payload: plan.coachEditedOutput ?? plan.aiOutput,
    });

    return this.getPlanById(centerId, planId);
  }

  public async generatePdf(centerId: number, planId: number) {
    const plan = await this.findPlanOrThrow(centerId, planId);
    if (!["approved", "sent_whatsapp"].includes(plan.status)) {
      throw new AppError("يجب اعتماد الخطة قبل إنشاء ملف PDF", 400);
    }

    const member = await memberReadFacade.findContactByIdInCenter(plan.memberId, centerId);
    const center = await authReadFacade.getCenterForAccess(centerId);

    if (!member || !center) {
      throw new AppError("تعذر تجهيز بيانات الخطة لإنشاء PDF", 404);
    }

    const pdfPath = await this.ensurePdfPath(plan, center.name, member.name, member.code);
    plan.pdfPath = pdfPath;
    await plan.save();

    return this.getPlanById(centerId, planId);
  }

  public async getPdfDownload(centerId: number, planId: number) {
    const plan = await this.findPlanOrThrow(centerId, planId);
    if (!plan.pdfPath) {
      throw new AppError("لم يتم إنشاء ملف PDF لهذه الخطة بعد", 404);
    }

    try {
      await fs.access(plan.pdfPath);
    } catch {
      throw new AppError("ملف PDF الخاص بالخطة غير موجود على الخادم", 404);
    }

    return {
      filePath: plan.pdfPath,
      fileName: path.basename(plan.pdfPath),
    };
  }

  public async sendPlanOnWhatsApp(centerId: number, planId: number, actorId: number) {
    const plan = await this.findPlanOrThrow(centerId, planId);
    if (!["approved", "sent_whatsapp"].includes(plan.status)) {
      throw new AppError("يجب اعتماد الخطة قبل إرسالها على واتساب", 400);
    }

    const [member, center] = await Promise.all([
      memberReadFacade.findContactByIdInCenter(plan.memberId, centerId),
      authReadFacade.getCenterForAccess(centerId),
    ]);

    if (!member || !center) {
      throw new AppError("تعذر تجهيز بيانات العضو أو المركز لإرسال الخطة", 404);
    }

    const pdfPath = await this.ensurePdfPath(plan, center.name, member.name, member.code);
    const dedupeKey = `ai-plan-pdf:${plan.id}:${Date.now()}`;
    const result = await whatsAppCommandFacade.queueAiPlanPdfMessage({
      centerId,
      memberId: member.id,
      filePath: pdfPath,
      fileName: path.basename(pdfPath),
      dedupeKey,
    });

    if (!result.queued || !result.message) {
      await AiPlanDeliveryLog.create({
        planId: plan.id,
        channel: "whatsapp",
        status: "failed",
        failureReason: result.reason ?? "تعذر تجهيز رسالة واتساب الخاصة بالخطة",
        createdBy: actorId,
      });

      throw new AppError(result.reason ?? "تعذر إرسال الخطة على واتساب", 400);
    }

    await AiPlanDeliveryLog.create({
      planId: plan.id,
      channel: "whatsapp",
      status: "queued",
      whatsappMessageId: result.message.id ?? null,
      sentAt: new Date(),
      createdBy: actorId,
    });

    plan.status = "sent_whatsapp";
    plan.sentAt = new Date();
    plan.updatedBy = actorId;
    await plan.save();

    return this.getPlanById(centerId, planId);
  }
}

export const aiPlanService = new AiPlanService();
