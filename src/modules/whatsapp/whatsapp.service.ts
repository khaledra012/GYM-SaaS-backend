import { Op, fn, col } from "sequelize";
import sequelize from "../../config/db.config";
import { AppError, logger } from "../../shared";
import { memberReadFacade } from "../member";
import { subscriptionReadFacade } from "../subscriptions";
import WhatsAppCampaign from "./whatsapp-campaign.model";
import { DEFAULT_WHATSAPP_TEMPLATES } from "./whatsapp.defaults";
import {
  IWhatsAppGatewaySessionUpdate,
  WhatsAppGateway,
} from "./whatsapp.gateway";
import WhatsAppDeliveryLog from "./whatsapp-delivery-log.model";
import WhatsAppMessage from "./whatsapp-message.model";
import WhatsAppModuleState from "./whatsapp-module-state.model";
import WhatsAppOptIn from "./whatsapp-opt-in.model";
import WhatsAppSession from "./whatsapp-session.model";
import WhatsAppTemplate from "./whatsapp-template.model";
import {
  ICreateWhatsAppCampaignDTO,
  ICreateWhatsAppTemplateDTO,
  IListWhatsAppCampaignsQuery,
  IListWhatsAppMessagesQuery,
  IPreviewWhatsAppCampaignDTO,
  IUpdateWhatsAppOptInDTO,
  IUpdateWhatsAppTemplateDTO,
} from "./whatsapp.schema";
import {
  WhatsAppCampaignAudienceType,
  WhatsAppCampaignStatus,
  WhatsAppDeliveryStatus,
  WhatsAppMessageStatus,
  WhatsAppTemplateEventType,
} from "./whatsapp.types";
import {
  buildSequentialDispatchTimes,
  classifyWhatsAppFailure,
  getRetryDelayMs,
  normalizeWhatsAppPhone,
  renderAndSpinWhatsAppTemplate,
  shouldMarkSessionDegraded,
  shouldPauseGlobalModule,
} from "./whatsapp.util";

interface IQueueTemplateMessageInput {
  centerId: number;
  eventType: WhatsAppTemplateEventType;
  phone: string;
  memberId?: number | null;
  campaignId?: number | null;
  dedupeKey?: string | null;
  templateBody?: string;
  requireOptIn?: boolean;
  variables: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown> | null;
  nextAttemptAt?: Date | null;
}

interface IQueueDocumentMessageInput {
  centerId: number;
  eventType: WhatsAppTemplateEventType;
  phone: string;
  filePath: string;
  fileName: string;
  mimetype: string;
  memberId?: number | null;
  dedupeKey?: string | null;
  templateBody?: string;
  requireOptIn?: boolean;
  variables: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown> | null;
  nextAttemptAt?: Date | null;
}

interface IQueueTemplateMessageResult {
  queued: boolean;
  reason?: string;
  alreadyQueued?: boolean;
  message: any | null;
}

interface ICampaignRecipient {
  memberId: number;
  code: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  subscriptionStatus: string | null;
}

interface ICampaignAudienceResolution {
  audienceType: WhatsAppCampaignAudienceType;
  totalMatchedMembers: number;
  optedInMembers: number;
  validPhoneMembers: number;
  recipientCount: number;
  skippedNoOptInCount: number;
  skippedInvalidPhoneCount: number;
  recipients: ICampaignRecipient[];
}

interface ICampaignStats {
  pending: number;
  processing: number;
  sent: number;
  failedRetryable: number;
  deferred: number;
  permanentFailed: number;
}

const GLOBAL_SCOPE_KEY = "global";
const MAX_SEND_ATTEMPTS = 3;
const GLOBAL_HEALTH_WINDOW_MS = 15 * 60 * 1000;
const MESSAGE_DISPATCH_BATCH_SIZE = 5;
const CAMPAIGN_MIN_DISPATCH_GAP_SECONDS = 60;
const CAMPAIGN_MAX_DISPATCH_GAP_SECONDS = 120;
const ACTIVE_SESSION_STATUSES = ["connecting", "qr_ready", "connected", "degraded"];
const SENDABLE_SESSION_STATUSES = new Set(["connected", "degraded"]);
const FAILURE_STATUSES: WhatsAppMessageStatus[] = [
  "failed_retryable",
  "permanent_failed",
];
const ATTEMPT_LOG_STATUSES: WhatsAppDeliveryStatus[] = [
  "sent",
  "failed_retryable",
  "permanent_failed",
];

class WhatsAppService {
  private readonly gateway = new WhatsAppGateway(
    async (centerId, update) => this.applyGatewaySessionUpdate(centerId, update),
  );

  private async ensureModuleState(): Promise<WhatsAppModuleState> {
    const [moduleState] = await WhatsAppModuleState.findOrCreate({
      where: { scopeKey: GLOBAL_SCOPE_KEY },
      defaults: {
        scopeKey: GLOBAL_SCOPE_KEY,
        status: "healthy",
      },
    });

    return moduleState;
  }

  private async ensureSession(centerId: number): Promise<WhatsAppSession> {
    const [session] = await WhatsAppSession.findOrCreate({
      where: { centerId },
      defaults: {
        centerId,
        status: "disconnected",
      },
    });

    return session;
  }

  private mapSession(session: WhatsAppSession | null) {
    if (!session) {
      return {
        centerId: null,
        status: "disconnected",
        phone: null,
        qrCodeDataUrl: null,
        pauseReason: null,
        lastConnectedAt: null,
        lastDisconnectedAt: null,
        lastQrAt: null,
        lastHealthCheckAt: null,
      };
    }

    return {
      id: session.id,
      centerId: session.centerId,
      status: session.status,
      phone: session.phone,
      qrCodeDataUrl: session.qrCodeDataUrl,
      pauseReason: session.pauseReason,
      lastConnectedAt: session.lastConnectedAt,
      lastDisconnectedAt: session.lastDisconnectedAt,
      lastQrAt: session.lastQrAt,
      lastHealthCheckAt: session.lastHealthCheckAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private mapModuleState(moduleState: WhatsAppModuleState) {
    return {
      status: moduleState.status,
      reason: moduleState.reason,
      pausedAt: moduleState.pausedAt,
      resumedAt: moduleState.resumedAt,
      failureRate:
        moduleState.failureRate === null ? null : Number(moduleState.failureRate),
      attemptsCount: moduleState.attemptsCount,
      evaluatedAt: moduleState.evaluatedAt,
    };
  }

  private mapTemplate(template: WhatsAppTemplate | null, fallback?: { name: string; body: string }) {
    if (!template && fallback) {
      return {
        id: null,
        centerId: null,
        eventType: null,
        name: fallback.name,
        body: fallback.body,
        isActive: true,
        isDefault: true,
      };
    }

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      centerId: template.centerId,
      eventType: template.eventType,
      name: template.name,
      body: template.body,
      isActive: template.isActive,
      isDefault: false,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  private mapMessage(message: WhatsAppMessage, displayNumber?: number) {
    const data = message.toJSON() as any;

    return {
      id: data.id,
      displayNumber,
      centerId: data.centerId,
      sessionId: data.sessionId,
      memberId: data.memberId,
      campaignId: data.campaignId,
      eventType: data.eventType,
      templateId: data.templateId,
      phone: data.phone,
      renderedBody: data.renderedBody,
      status: data.status,
      failureType: data.failureType,
      failureCode: data.failureCode,
      failureReason: data.failureReason,
      attempts: data.attempts,
      nextAttemptAt: data.nextAttemptAt,
      lastAttemptAt: data.lastAttemptAt,
      sentAt: data.sentAt,
      metadata: data.metadata,
      member: data.member
        ? {
            id: data.member.id,
            name: data.member.name,
            phone: data.member.phone,
            code: data.member.code,
          }
        : null,
      campaign: data.campaign
        ? {
            id: data.campaign.id,
            name: data.campaign.name,
            status: data.campaign.status,
            audienceType: data.campaign.audienceType,
          }
        : null,
      session: data.session
        ? {
            id: data.session.id,
            status: data.session.status,
            phone: data.session.phone,
          }
        : null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private buildEmptyCampaignStats(): ICampaignStats {
    return {
      pending: 0,
      processing: 0,
      sent: 0,
      failedRetryable: 0,
      deferred: 0,
      permanentFailed: 0,
    };
  }

  private inferCampaignStatus(
    campaign: WhatsAppCampaign,
    stats: ICampaignStats,
  ): WhatsAppCampaignStatus {
    if (campaign.status === "paused" || campaign.status === "cancelled") {
      return campaign.status;
    }

    const outstanding =
      stats.pending + stats.processing + stats.failedRetryable + stats.deferred;

    if (campaign.totalRecipients > 0 && outstanding === 0) {
      return "completed";
    }

    if (stats.sent > 0 || stats.processing > 0) {
      return "running";
    }

    return "queued";
  }

  private mapCampaign(
    campaign: WhatsAppCampaign,
    stats: ICampaignStats,
    displayNumber?: number,
  ) {
    const inferredStatus = this.inferCampaignStatus(campaign, stats);
    const deliveredCount = stats.sent;
    const failedCount = stats.permanentFailed;
    const inQueueCount =
      stats.pending + stats.processing + stats.failedRetryable + stats.deferred;
    const progressPercentage =
      campaign.totalRecipients > 0
        ? Math.round(((deliveredCount + failedCount) / campaign.totalRecipients) * 100)
        : 0;

    return {
      id: campaign.id,
      displayNumber,
      centerId: campaign.centerId,
      name: campaign.name,
      audienceType: campaign.audienceType,
      messageTemplate: campaign.messageTemplate,
      status: inferredStatus,
      totalRecipients: campaign.totalRecipients,
      deliveredCount,
      failedCount,
      pendingCount: stats.pending,
      processingCount: stats.processing,
      retryableCount: stats.failedRetryable,
      deferredCount: stats.deferred,
      inQueueCount,
      progressPercentage,
      createdBy: campaign.createdBy,
      launchedAt: campaign.launchedAt,
      pausedAt: campaign.pausedAt,
      resumedAt: campaign.resumedAt,
      cancelledAt: campaign.cancelledAt,
      completedAt:
        inferredStatus === "completed"
          ? campaign.completedAt ?? campaign.updatedAt ?? null
          : campaign.completedAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private async getCampaignStatsMap(
    campaignIds: number[],
  ): Promise<Map<number, ICampaignStats>> {
    const statsMap = new Map<number, ICampaignStats>();

    for (const campaignId of campaignIds) {
      statsMap.set(campaignId, this.buildEmptyCampaignStats());
    }

    if (campaignIds.length === 0) {
      return statsMap;
    }

    const rows = (await WhatsAppMessage.findAll({
      attributes: [
        "campaignId",
        "status",
        [fn("COUNT", col("id")), "count"],
      ],
      where: {
        campaignId: {
          [Op.in]: campaignIds,
        },
      },
      group: ["campaignId", "status"],
      raw: true,
    })) as unknown as Array<{
      campaignId: number;
      status: WhatsAppMessageStatus;
      count: number | string;
    }>;

    for (const row of rows) {
      const campaignId = Number(row.campaignId);
      const target = statsMap.get(campaignId) ?? this.buildEmptyCampaignStats();
      const count = Number(row.count);

      switch (row.status) {
        case "pending":
          target.pending += count;
          break;
        case "processing":
          target.processing += count;
          break;
        case "sent":
          target.sent += count;
          break;
        case "failed_retryable":
          target.failedRetryable += count;
          break;
        case "deferred":
          target.deferred += count;
          break;
        case "permanent_failed":
          target.permanentFailed += count;
          break;
      }

      statsMap.set(campaignId, target);
    }

    return statsMap;
  }

  private async createDeliveryLog(
    centerId: number,
    messageId: number,
    sessionId: number | null,
    status: WhatsAppDeliveryStatus,
    details?: string | null,
  ) {
    await WhatsAppDeliveryLog.create({
      centerId,
      messageId,
      sessionId,
      status,
      details: details ?? null,
    });
  }

  private async isMemberOptedIn(
    centerId: number,
    memberId: number,
  ): Promise<boolean> {
    const record = await WhatsAppOptIn.findOne({
      where: {
        centerId,
        memberId,
      },
      raw: true,
    });

    return Boolean((record as any)?.isOptedIn);
  }

  private async resolveTemplate(
    centerId: number,
    eventType: WhatsAppTemplateEventType,
    explicitTemplateBody?: string,
  ): Promise<{ templateId: number | null; name: string; body: string }> {
    if (explicitTemplateBody?.trim()) {
      return {
        templateId: null,
        name: "قالب مخصص",
        body: explicitTemplateBody.trim(),
      };
    }

    const centerTemplate = await WhatsAppTemplate.findOne({
      where: {
        centerId,
        eventType,
        isActive: true,
      },
      order: [["updatedAt", "DESC"]],
    });

    if (centerTemplate) {
      return {
        templateId: centerTemplate.id,
        name: centerTemplate.name,
        body: centerTemplate.body,
      };
    }

    const defaultTemplate = DEFAULT_WHATSAPP_TEMPLATES.find(
      (template) => template.eventType === eventType,
    );

    if (!defaultTemplate) {
      throw new AppError("لا يوجد قالب افتراضي لهذا النوع من الرسائل", 500);
    }

    return {
      templateId: null,
      name: defaultTemplate.name,
      body: defaultTemplate.body,
    };
  }

  private async ensureCampaignInCenter(
    centerId: number,
    campaignId: number,
  ): Promise<WhatsAppCampaign> {
    const campaign = await WhatsAppCampaign.findOne({
      where: {
        id: campaignId,
        centerId,
      },
    });

    if (!campaign) {
      throw new AppError("الحملة غير موجودة", 404);
    }

    return campaign;
  }

  private buildCampaignName(name: string | undefined, audienceType: WhatsAppCampaignAudienceType) {
    if (name?.trim()) {
      return name.trim();
    }

    const labelByAudience: Record<WhatsAppCampaignAudienceType, string> = {
      all_members: "كل الأعضاء",
      active_subscriptions: "الاشتراكات النشطة",
      expired_subscriptions: "الاشتراكات المنتهية",
    };

    return `حملة ${labelByAudience[audienceType]} ${new Date().toLocaleString("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  private async resolveCampaignAudience(
    centerId: number,
    audienceType: WhatsAppCampaignAudienceType,
  ): Promise<ICampaignAudienceResolution> {
    const members = await memberReadFacade.listContactsByCenter(centerId);
    const memberIds = members.map((member) => member.id);
    const subscriptionsByMember = await subscriptionReadFacade.getLatestByMemberIds(
      centerId,
      memberIds,
    );

    const targetedMembers = members.filter((member) => {
      if (audienceType === "all_members") {
        return true;
      }

      const snapshot = subscriptionsByMember.get(member.id);
      if (!snapshot) {
        return false;
      }

      if (audienceType === "active_subscriptions") {
        return snapshot.effectiveStatus === "active";
      }

      return snapshot.effectiveStatus === "expired";
    });

    const targetedIds = targetedMembers.map((member) => member.id);
    const optedInMemberIds = new Set<number>();

    if (targetedIds.length > 0) {
      const optIns = await WhatsAppOptIn.findAll({
        where: {
          centerId,
          memberId: {
            [Op.in]: targetedIds,
          },
          isOptedIn: true,
        },
        attributes: ["memberId"],
        raw: true,
      });

      for (const item of optIns as Array<{ memberId: number }>) {
        optedInMemberIds.add(item.memberId);
      }
    }

    const recipients: ICampaignRecipient[] = [];
    let optedInMembers = 0;
    let validPhoneMembers = 0;

    for (const member of targetedMembers) {
      const isOptedIn = optedInMemberIds.has(member.id);
      if (isOptedIn) {
        optedInMembers += 1;
      }

      const normalizedPhone = normalizeWhatsAppPhone(member.phone);
      if (normalizedPhone) {
        validPhoneMembers += 1;
      }

      if (!normalizedPhone) {
        continue;
      }

      recipients.push({
        memberId: member.id,
        code: member.code,
        name: member.name,
        phone: member.phone,
        normalizedPhone,
        subscriptionStatus:
          subscriptionsByMember.get(member.id)?.effectiveStatus ?? null,
      });
    }

    return {
      audienceType,
      totalMatchedMembers: targetedMembers.length,
      optedInMembers,
      validPhoneMembers,
      recipientCount: recipients.length,
      skippedNoOptInCount: 0,
      skippedInvalidPhoneCount: Math.max(0, targetedMembers.length - recipients.length),
      recipients,
    };
  }

  private async syncCampaignStatus(campaignId: number): Promise<WhatsAppCampaign | null> {
    const campaign = await WhatsAppCampaign.findByPk(campaignId);
    if (!campaign) {
      return null;
    }

    if (campaign.status === "paused" || campaign.status === "cancelled") {
      return campaign;
    }

    const stats = (await this.getCampaignStatsMap([campaign.id])).get(campaign.id) ??
      this.buildEmptyCampaignStats();
    const inferredStatus = this.inferCampaignStatus(campaign, stats);

    if (inferredStatus !== campaign.status) {
      campaign.status = inferredStatus;
      if (inferredStatus === "completed" && !campaign.completedAt) {
        campaign.completedAt = new Date();
      }
      await campaign.save();
    }

    return campaign;
  }

  private async markMessageDeferred(
    message: WhatsAppMessage,
    sessionId: number | null,
    reason: string,
  ) {
    message.sessionId = sessionId;
    message.status = "deferred";
    message.failureType = "retryable";
    message.failureCode = "deferred";
    message.failureReason = reason;
    message.nextAttemptAt = null;
    await message.save();

    await this.createDeliveryLog(
      message.centerId,
      message.id,
      sessionId,
      "deferred",
      reason,
    );
  }

  private async markMessageProcessing(
    message: WhatsAppMessage,
    sessionId: number | null,
  ): Promise<number> {
    const attempts = message.attempts + 1;
    message.sessionId = sessionId;
    message.status = "processing";
    message.attempts = attempts;
    message.lastAttemptAt = new Date();
    await message.save();

    await this.createDeliveryLog(
      message.centerId,
      message.id,
      sessionId,
      "processing",
      `بدء المحاولة رقم ${attempts}`,
    );

    return attempts;
  }

  private async markMessageSent(
    message: WhatsAppMessage,
    sessionId: number | null,
    providerMessageId: string | null,
  ) {
    message.sessionId = sessionId;
    message.status = "sent";
    message.failureType = null;
    message.failureCode = null;
    message.failureReason = null;
    message.nextAttemptAt = null;
    message.sentAt = new Date();
    message.metadata = {
      ...(message.metadata ?? {}),
      providerMessageId,
    };
    await message.save();

    await this.createDeliveryLog(
      message.centerId,
      message.id,
      sessionId,
      "sent",
      providerMessageId ? `providerMessageId=${providerMessageId}` : null,
    );
  }

  private async markMessageFailed(
    message: WhatsAppMessage,
    sessionId: number | null,
    failure: ReturnType<typeof classifyWhatsAppFailure>,
    attempts: number,
  ) {
    message.sessionId = sessionId;
    message.failureType = failure.failureType;
    message.failureCode = failure.failureCode;
    message.failureReason = failure.failureReason;

    const shouldDefer =
      failure.failureCode === "module_paused" ||
      failure.failureCode === "session_paused" ||
      failure.failureCode === "session_unavailable";

    if (shouldDefer) {
      message.status = "deferred";
      message.nextAttemptAt = null;
      await message.save();

      await this.createDeliveryLog(
        message.centerId,
        message.id,
        sessionId,
        "deferred",
        failure.failureReason,
      );
      return;
    }

    if (failure.failureType === "fatal" || attempts >= MAX_SEND_ATTEMPTS) {
      message.status = "permanent_failed";
      message.nextAttemptAt = null;
      await message.save();

      await this.createDeliveryLog(
        message.centerId,
        message.id,
        sessionId,
        "permanent_failed",
        failure.failureReason,
      );
      return;
    }

    message.status = "failed_retryable";
    message.nextAttemptAt = new Date(Date.now() + getRetryDelayMs(attempts));
    await message.save();

    await this.createDeliveryLog(
      message.centerId,
      message.id,
      sessionId,
      "failed_retryable",
      failure.failureReason,
    );
  }

  private async releaseDeferredMessages(centerId?: number, campaignId?: number) {
    const where: any = {
      status: "deferred",
    };

    if (centerId) {
      where.centerId = centerId;
    }

    if (campaignId) {
      where.campaignId = campaignId;
    }

    await WhatsAppMessage.update(
      {
        status: "pending",
        nextAttemptAt: new Date(),
      },
      { where },
    );
  }

  public async applyGatewaySessionUpdate(
    centerId: number,
    update: IWhatsAppGatewaySessionUpdate,
  ): Promise<void> {
    const session = await this.ensureSession(centerId);

    session.status = update.status;
    if (update.phone !== undefined) {
      session.phone = update.phone ?? null;
    }
    if (update.qrCodeDataUrl !== undefined) {
      session.qrCodeDataUrl = update.qrCodeDataUrl ?? null;
    }
    if (update.pauseReason !== undefined) {
      session.pauseReason = update.pauseReason ?? null;
    }
    if (update.lastConnectedAt !== undefined) {
      session.lastConnectedAt = update.lastConnectedAt ?? null;
    }
    if (update.lastDisconnectedAt !== undefined) {
      session.lastDisconnectedAt = update.lastDisconnectedAt ?? null;
    }
    if (update.lastQrAt !== undefined) {
      session.lastQrAt = update.lastQrAt ?? null;
    }
    if (update.metadata !== undefined) {
      session.metadata = update.metadata ?? null;
    }
    session.lastHealthCheckAt = new Date();
    await session.save();

    if (update.status === "connected") {
      await this.releaseDeferredMessages(centerId);
    }
  }

  public async pauseModule(reason: string, attemptsCount?: number, failureRate?: number) {
    const moduleState = await this.ensureModuleState();
    moduleState.status = "paused";
    moduleState.reason = reason;
    moduleState.pausedAt = new Date();
    moduleState.failureRate = failureRate ?? moduleState.failureRate;
    moduleState.attemptsCount = attemptsCount ?? moduleState.attemptsCount;
    moduleState.evaluatedAt = new Date();
    await moduleState.save();

    return moduleState;
  }

  public async resumeModule() {
    const moduleState = await this.ensureModuleState();
    moduleState.status = "healthy";
    moduleState.reason = null;
    moduleState.resumedAt = new Date();
    moduleState.evaluatedAt = new Date();
    await moduleState.save();

    await this.releaseDeferredMessages();

    return this.mapModuleState(moduleState);
  }

  public async getStatus(centerId: number) {
    const [session, moduleState] = await Promise.all([
      WhatsAppSession.findOne({ where: { centerId } }),
      this.ensureModuleState(),
    ]);

    return {
      module: this.mapModuleState(moduleState),
      session: this.mapSession(session),
    };
  }

  public async connectSession(centerId: number) {
    await this.ensureSession(centerId);
    await this.gateway.connect(centerId);
    return this.getStatus(centerId);
  }

  public async disconnectSession(centerId: number) {
    await this.gateway.disconnect(centerId);
    return this.getStatus(centerId);
  }

  public async listTemplates(centerId: number) {
    const templates = await WhatsAppTemplate.findAll({
      where: {
        centerId,
      },
      order: [
        ["eventType", "ASC"],
        ["updatedAt", "DESC"],
      ],
    });

    const latestByEvent = new Map<WhatsAppTemplateEventType, WhatsAppTemplate>();
    for (const template of templates) {
      if (!latestByEvent.has(template.eventType)) {
        latestByEvent.set(template.eventType, template);
      }
    }

    return DEFAULT_WHATSAPP_TEMPLATES.map((defaultTemplate) =>
      this.mapTemplate(latestByEvent.get(defaultTemplate.eventType) ?? null, {
        name: defaultTemplate.name,
        body: defaultTemplate.body,
      }),
    );
  }

  public async createTemplate(
    centerId: number,
    input: ICreateWhatsAppTemplateDTO,
  ) {
    return sequelize.transaction(async (transaction) => {
      await WhatsAppTemplate.update(
        { isActive: false },
        {
          where: {
            centerId,
            eventType: input.eventType,
            isActive: true,
          },
          transaction,
        },
      );

      const template = await WhatsAppTemplate.create(
        {
          centerId,
          eventType: input.eventType,
          name: input.name,
          body: input.body,
          isActive: input.isActive ?? true,
        },
        { transaction },
      );

      return this.mapTemplate(template);
    });
  }

  public async updateTemplate(
    centerId: number,
    templateId: number,
    input: IUpdateWhatsAppTemplateDTO,
  ) {
    return sequelize.transaction(async (transaction) => {
      const template = await WhatsAppTemplate.findOne({
        where: {
          id: templateId,
          centerId,
        },
        transaction,
        lock: true,
      });

      if (!template) {
        throw new AppError("قالب الواتساب غير موجود", 404);
      }

      if (input.name !== undefined) template.name = input.name;
      if (input.body !== undefined) template.body = input.body;
      if (input.isActive !== undefined) {
        if (input.isActive) {
          await WhatsAppTemplate.update(
            { isActive: false },
            {
              where: {
                centerId,
                eventType: template.eventType,
                id: {
                  [Op.ne]: template.id,
                },
              },
              transaction,
            },
          );
        }

        template.isActive = input.isActive;
      }

      await template.save({ transaction });

      return this.mapTemplate(template);
    });
  }

  public async getMemberOptIn(centerId: number, memberId: number) {
    const member = await memberReadFacade.findByIdInCenter(memberId, centerId);
    if (!member) {
      throw new AppError("العضو غير موجود", 404);
    }

    const optIn = await WhatsAppOptIn.findOne({
      where: {
        centerId,
        memberId,
      },
    });

    return {
      memberId,
      isOptedIn: optIn?.isOptedIn ?? false,
      source: optIn?.source ?? null,
      updatedAt: optIn?.updatedAt ?? null,
    };
  }

  public async updateMemberOptIn(
    centerId: number,
    memberId: number,
    input: IUpdateWhatsAppOptInDTO & { updatedBy: number },
  ) {
    const member = await memberReadFacade.findByIdInCenter(memberId, centerId);
    if (!member) {
      throw new AppError("العضو غير موجود", 404);
    }

    const [optIn] = await WhatsAppOptIn.findOrCreate({
      where: {
        centerId,
        memberId,
      },
      defaults: {
        centerId,
        memberId,
        isOptedIn: input.isOptedIn,
        source: input.source ?? null,
        updatedBy: input.updatedBy,
      },
    });

    optIn.isOptedIn = input.isOptedIn;
    optIn.source = input.source ?? optIn.source;
    optIn.updatedBy = input.updatedBy;
    await optIn.save();

    return {
      memberId,
      isOptedIn: optIn.isOptedIn,
      source: optIn.source,
      updatedAt: optIn.updatedAt,
    };
  }

  public async previewCampaign(
    centerId: number,
    input: IPreviewWhatsAppCampaignDTO,
  ) {
    const audience = await this.resolveCampaignAudience(centerId, input.audienceType);

    return {
      name: this.buildCampaignName(input.name, input.audienceType),
      audienceType: input.audienceType,
      message: input.message,
      totalMatchedMembers: audience.totalMatchedMembers,
      optedInMembers: audience.optedInMembers,
      validPhoneMembers: audience.validPhoneMembers,
      recipientCount: audience.recipientCount,
      skippedNoOptInCount: audience.skippedNoOptInCount,
      skippedInvalidPhoneCount: audience.skippedInvalidPhoneCount,
      sampleRecipients: audience.recipients.slice(0, 5).map((recipient) => ({
        memberId: recipient.memberId,
        name: recipient.name,
        phone: recipient.phone,
        code: recipient.code,
        subscriptionStatus: recipient.subscriptionStatus,
      })),
      supportedVariables: ["{{name}}", "{{member_code}}", "{{phone}}", "{{gym_name}}"],
    };
  }

  public async createCampaign(
    centerId: number,
    createdBy: number | null,
    gymName: string,
    input: ICreateWhatsAppCampaignDTO,
  ) {
    const audience = await this.resolveCampaignAudience(centerId, input.audienceType);

    if (audience.recipientCount === 0) {
      throw new AppError(
        "لا يوجد أعضاء مؤهلون لهذه الحملة بعد تطبيق الفلتر وصحة رقم الهاتف",
        400,
      );
    }

    const campaignName = this.buildCampaignName(input.name, input.audienceType);
    const scheduledTimes = buildSequentialDispatchTimes(
      audience.recipientCount,
      new Date(),
      Math.random,
      CAMPAIGN_MIN_DISPATCH_GAP_SECONDS,
      CAMPAIGN_MAX_DISPATCH_GAP_SECONDS,
    );

    return sequelize.transaction(async (transaction) => {
      const campaign = await WhatsAppCampaign.create(
        {
          centerId,
          name: campaignName,
          audienceType: input.audienceType,
          messageTemplate: input.message.trim(),
          status: "queued",
          totalRecipients: audience.recipientCount,
          createdBy,
          launchedAt: new Date(),
        },
        { transaction },
      );

      const messages = audience.recipients.map((recipient, index) => ({
        centerId,
        sessionId: null,
        memberId: recipient.memberId,
        campaignId: campaign.id,
        eventType: "campaign_broadcast" as const,
        templateId: null,
        dedupeKey: `campaign:${campaign.id}:member:${recipient.memberId}`,
        phone: recipient.normalizedPhone,
        renderedBody: renderAndSpinWhatsAppTemplate(input.message.trim(), {
          name: recipient.name,
          member_code: recipient.code,
          phone: recipient.phone,
          gym_name: gymName,
        }).trim(),
        status: "pending" as const,
        nextAttemptAt: scheduledTimes[index],
        metadata: {
          source: "campaign_broadcast",
          campaignId: campaign.id,
          audienceType: input.audienceType,
        },
      }));

      for (const messagePayload of messages) {
        const createdMessage = await WhatsAppMessage.create(messagePayload, {
          transaction,
        });

        await WhatsAppDeliveryLog.create(
          {
            centerId,
            messageId: createdMessage.id,
            sessionId: null,
            status: "queued",
            details: "تمت إضافة الرسالة إلى طابور الحملة",
          },
          { transaction },
        );
      }

      const stats = this.buildEmptyCampaignStats();
      stats.pending = audience.recipientCount;

      return {
        campaign: this.mapCampaign(campaign, stats),
        preview: {
          totalMatchedMembers: audience.totalMatchedMembers,
          optedInMembers: audience.optedInMembers,
          validPhoneMembers: audience.validPhoneMembers,
          recipientCount: audience.recipientCount,
          skippedNoOptInCount: audience.skippedNoOptInCount,
          skippedInvalidPhoneCount: audience.skippedInvalidPhoneCount,
        },
      };
    });
  }

  public async listCampaigns(
    centerId: number,
    query: IListWhatsAppCampaignsQuery,
  ) {
    const where: any = { centerId };
    if (query.status) {
      where.status = query.status;
    }

    const offset = (query.page - 1) * query.limit;
    const { rows, count } = await WhatsAppCampaign.findAndCountAll({
      where,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: query.limit,
      offset,
    });

    const statsMap = await this.getCampaignStatsMap(rows.map((campaign) => campaign.id));

    return {
      total: count,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(count / query.limit)),
      data: rows.map((campaign, index) =>
        this.mapCampaign(
          campaign,
          statsMap.get(campaign.id) ?? this.buildEmptyCampaignStats(),
          offset + index + 1,
        ),
      ),
    };
  }

  public async getCampaignById(centerId: number, campaignId: number) {
    const campaign = await this.ensureCampaignInCenter(centerId, campaignId);
    await this.syncCampaignStatus(campaign.id);
    const freshCampaign = await this.ensureCampaignInCenter(centerId, campaignId);
    const stats = (await this.getCampaignStatsMap([campaign.id])).get(campaign.id) ??
      this.buildEmptyCampaignStats();

    return this.mapCampaign(freshCampaign, stats);
  }

  public async pauseCampaign(centerId: number, campaignId: number) {
    const campaign = await this.ensureCampaignInCenter(centerId, campaignId);

    if (campaign.status === "cancelled") {
      throw new AppError("لا يمكن إيقاف حملة ملغاة", 400);
    }

    if (campaign.status === "completed") {
      throw new AppError("الحملة مكتملة بالفعل", 400);
    }

    campaign.status = "paused";
    campaign.pausedAt = new Date();
    await campaign.save();

    await WhatsAppMessage.update(
      {
        status: "deferred",
        failureType: "retryable",
        failureCode: "campaign_paused",
        failureReason: "تم إيقاف الحملة مؤقتًا",
        nextAttemptAt: null,
      },
      {
        where: {
          centerId,
          campaignId,
          status: {
            [Op.in]: ["pending", "failed_retryable", "deferred"],
          },
        },
      },
    );

    const stats = (await this.getCampaignStatsMap([campaign.id])).get(campaign.id) ??
      this.buildEmptyCampaignStats();

    return this.mapCampaign(campaign, stats);
  }

  public async resumeCampaign(centerId: number, campaignId: number) {
    const campaign = await this.ensureCampaignInCenter(centerId, campaignId);

    if (campaign.status !== "paused") {
      throw new AppError("لا يمكن استئناف حملة غير موقوفة", 400);
    }

    const deferredMessages = await WhatsAppMessage.findAll({
      where: {
        centerId,
        campaignId,
        status: "deferred",
      },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });

    const scheduledTimes = buildSequentialDispatchTimes(
      deferredMessages.length,
      new Date(),
      Math.random,
      CAMPAIGN_MIN_DISPATCH_GAP_SECONDS,
      CAMPAIGN_MAX_DISPATCH_GAP_SECONDS,
    );

    for (const [index, message] of deferredMessages.entries()) {
      message.status = "pending";
      message.failureType = null;
      message.failureCode = null;
      message.failureReason = null;
      message.nextAttemptAt = scheduledTimes[index] ?? new Date();
      await message.save();
    }

    campaign.status = deferredMessages.length > 0 ? "queued" : "running";
    campaign.resumedAt = new Date();
    await campaign.save();

    const stats = (await this.getCampaignStatsMap([campaign.id])).get(campaign.id) ??
      this.buildEmptyCampaignStats();

    return this.mapCampaign(campaign, stats);
  }

  public async cancelCampaign(centerId: number, campaignId: number) {
    const campaign = await this.ensureCampaignInCenter(centerId, campaignId);

    if (campaign.status === "cancelled") {
      throw new AppError("الحملة ملغاة بالفعل", 400);
    }

    if (campaign.status === "completed") {
      throw new AppError("لا يمكن إلغاء حملة مكتملة", 400);
    }

    campaign.status = "cancelled";
    campaign.cancelledAt = new Date();
    await campaign.save();

    await WhatsAppMessage.update(
      {
        status: "permanent_failed",
        failureType: "fatal",
        failureCode: "campaign_cancelled",
        failureReason: "تم إلغاء الحملة قبل الإرسال",
        nextAttemptAt: null,
      },
      {
        where: {
          centerId,
          campaignId,
          status: {
            [Op.in]: ["pending", "failed_retryable", "deferred"],
          },
        },
      },
    );

    const stats = (await this.getCampaignStatsMap([campaign.id])).get(campaign.id) ??
      this.buildEmptyCampaignStats();

    return this.mapCampaign(campaign, stats);
  }

  public async queueTemplateMessage(
    input: IQueueTemplateMessageInput,
  ): Promise<IQueueTemplateMessageResult> {
    if (
      input.requireOptIn !== false &&
      input.memberId &&
      !(await this.isMemberOptedIn(input.centerId, input.memberId))
    ) {
      return {
        queued: false,
        reason: "العضو لم يوافق بعد على استقبال رسائل واتساب",
        message: null,
      };
    }

    const normalizedPhone = normalizeWhatsAppPhone(input.phone);
    if (!normalizedPhone) {
      return {
        queued: false,
        reason: "رقم الهاتف غير صالح للإرسال عبر واتساب",
        message: null,
      };
    }

    if (input.dedupeKey) {
      const existing = await WhatsAppMessage.findOne({
        where: {
          centerId: input.centerId,
          dedupeKey: input.dedupeKey,
        },
      });

      if (existing) {
        return {
          queued: true,
          alreadyQueued: true,
          message: this.mapMessage(existing),
        };
      }
    }

    const resolvedTemplate = await this.resolveTemplate(
      input.centerId,
      input.eventType,
      input.templateBody,
    );
    const renderedBody = renderAndSpinWhatsAppTemplate(
      resolvedTemplate.body,
      input.variables,
    ).trim();

    const message = await WhatsAppMessage.create({
      centerId: input.centerId,
      sessionId: null,
      memberId: input.memberId ?? null,
      campaignId: input.campaignId ?? null,
      eventType: input.eventType,
      templateId: resolvedTemplate.templateId,
      dedupeKey: input.dedupeKey ?? null,
      phone: normalizedPhone,
      renderedBody,
      status: "pending",
      nextAttemptAt: input.nextAttemptAt ?? new Date(),
      metadata: input.metadata ?? null,
    });

    await this.createDeliveryLog(
      input.centerId,
      message.id,
      null,
      "queued",
      "تمت إضافة الرسالة إلى طابور الإرسال",
    );

    return {
      queued: true,
      message: this.mapMessage(message),
    };
  }

  public async queueDocumentMessage(
    input: IQueueDocumentMessageInput,
  ): Promise<IQueueTemplateMessageResult> {
    if (
      input.requireOptIn !== false &&
      input.memberId &&
      !(await this.isMemberOptedIn(input.centerId, input.memberId))
    ) {
      return {
        queued: false,
        reason: "العضو لم يوافق بعد على استقبال رسائل واتساب",
        message: null,
      };
    }

    const normalizedPhone = normalizeWhatsAppPhone(input.phone);
    if (!normalizedPhone) {
      return {
        queued: false,
        reason: "رقم الهاتف غير صالح للإرسال عبر واتساب",
        message: null,
      };
    }

    if (input.dedupeKey) {
      const existing = await WhatsAppMessage.findOne({
        where: {
          centerId: input.centerId,
          dedupeKey: input.dedupeKey,
        },
      });

      if (existing) {
        return {
          queued: true,
          alreadyQueued: true,
          message: this.mapMessage(existing),
        };
      }
    }

    const resolvedTemplate = await this.resolveTemplate(
      input.centerId,
      input.eventType,
      input.templateBody,
    );
    const renderedBody = renderAndSpinWhatsAppTemplate(
      resolvedTemplate.body,
      input.variables,
    ).trim();

    const message = await WhatsAppMessage.create({
      centerId: input.centerId,
      sessionId: null,
      memberId: input.memberId ?? null,
      campaignId: null,
      eventType: input.eventType,
      templateId: resolvedTemplate.templateId,
      dedupeKey: input.dedupeKey ?? null,
      phone: normalizedPhone,
      renderedBody,
      status: "pending",
      nextAttemptAt: input.nextAttemptAt ?? new Date(),
      metadata: {
        ...(input.metadata ?? {}),
        attachment: {
          type: "document",
          filePath: input.filePath,
          fileName: input.fileName,
          mimetype: input.mimetype,
        },
      },
    });

    await this.createDeliveryLog(
      input.centerId,
      message.id,
      null,
      "queued",
      "تمت إضافة الملف إلى طابور الإرسال",
    );

    return {
      queued: true,
      message: this.mapMessage(message),
    };
  }

  public async sendTestMessage(
    centerId: number,
    phone: string,
    message: string,
    gymName: string,
  ) {
    return this.queueTemplateMessage({
      centerId,
      eventType: "manual_test",
      phone,
      requireOptIn: false,
      variables: {
        gym_name: gymName,
      },
      templateBody: message,
      metadata: {
        source: "manual_test",
      },
    });
  }

  public async listMessages(centerId: number, query: IListWhatsAppMessagesQuery) {
    const where: any = {
      centerId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    if (query.campaignId) {
      where.campaignId = query.campaignId;
    }

    const offset = (query.page - 1) * query.limit;

    const { rows, count } = await WhatsAppMessage.findAndCountAll({
      where,
      include: [
        {
          association: "member",
          attributes: ["id", "name", "phone", "code"],
          required: false,
        },
        {
          association: "campaign",
          attributes: ["id", "name", "status", "audienceType"],
          required: false,
        },
        {
          association: "session",
          attributes: ["id", "status", "phone"],
          required: false,
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: query.limit,
      offset,
      distinct: true,
    });

    return {
      total: count,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(count / query.limit)),
      data: rows.map((message, index) =>
        this.mapMessage(message, offset + index + 1),
      ),
    };
  }

  public async evaluateSessionHealth(centerId: number, sessionId: number | null) {
    if (!sessionId) {
      return;
    }

    const session = await WhatsAppSession.findOne({
      where: {
        id: sessionId,
        centerId,
      },
    });

    if (!session) {
      return;
    }

    const since = new Date(Date.now() - GLOBAL_HEALTH_WINDOW_MS);
    const [totalAttempts, failedAttempts] = await Promise.all([
      WhatsAppDeliveryLog.count({
        where: {
          centerId,
          sessionId,
          createdAt: { [Op.gte]: since },
          status: { [Op.in]: ATTEMPT_LOG_STATUSES },
        },
      }),
      WhatsAppDeliveryLog.count({
        where: {
          centerId,
          sessionId,
          createdAt: { [Op.gte]: since },
          status: { [Op.in]: ["failed_retryable", "permanent_failed"] },
        },
      }),
    ]);

    session.lastHealthCheckAt = new Date();

    if (shouldMarkSessionDegraded({ totalAttempts, failedAttempts })) {
      if (session.status === "connected") {
        session.status = "degraded";
        session.pauseReason = "ارتفاع نسبة الفشل على هذه الجلسة";
      }
    } else if (session.status === "degraded") {
      session.status = "connected";
      session.pauseReason = null;
    }

    await session.save();
  }

  public async evaluateGlobalPauseGuard() {
    const moduleState = await this.ensureModuleState();
    const activeSessions = await WhatsAppSession.findAll({
      where: {
        status: {
          [Op.in]: ACTIVE_SESSION_STATUSES,
        },
      },
      attributes: ["id"],
      raw: true,
    });

    const activeSessionIds = (activeSessions as Array<{ id: number }>).map(
      (session) => session.id,
    );
    const since = new Date(Date.now() - GLOBAL_HEALTH_WINDOW_MS);

    let totalAttempts = 0;
    let failedAttempts = 0;

    if (activeSessionIds.length > 0) {
      [totalAttempts, failedAttempts] = await Promise.all([
        WhatsAppDeliveryLog.count({
          where: {
            sessionId: {
              [Op.in]: activeSessionIds,
            },
            createdAt: {
              [Op.gte]: since,
            },
            status: {
              [Op.in]: ATTEMPT_LOG_STATUSES,
            },
          },
        }),
        WhatsAppDeliveryLog.count({
          where: {
            sessionId: {
              [Op.in]: activeSessionIds,
            },
            createdAt: {
              [Op.gte]: since,
            },
            status: {
              [Op.in]: ["failed_retryable", "permanent_failed"],
            },
          },
        }),
      ]);
    }

    const failureRate = totalAttempts > 0 ? failedAttempts / totalAttempts : 0;
    moduleState.failureRate = totalAttempts > 0 ? failureRate : 0;
    moduleState.attemptsCount = totalAttempts;
    moduleState.evaluatedAt = new Date();

    if (
      moduleState.status !== "paused" &&
      shouldPauseGlobalModule({ totalAttempts, failedAttempts })
    ) {
      moduleState.status = "paused";
      moduleState.reason = "GLOBAL_FAILURE_RATE_EXCEEDED";
      moduleState.pausedAt = new Date();
      await moduleState.save();
      return this.mapModuleState(moduleState);
    }

    await moduleState.save();
    return this.mapModuleState(moduleState);
  }

  private async processMessage(message: WhatsAppMessage): Promise<void> {
    if (message.campaignId) {
      const campaign = await WhatsAppCampaign.findByPk(message.campaignId);

      if (!campaign) {
        message.campaignId = null;
        await message.save();
      } else if (campaign.status === "paused") {
        await this.markMessageDeferred(
          message,
          message.sessionId,
          "الحملة موقوفة مؤقتًا",
        );
        return;
      } else if (campaign.status === "cancelled") {
        message.status = "permanent_failed";
        message.failureType = "fatal";
        message.failureCode = "campaign_cancelled";
        message.failureReason = "تم إلغاء الحملة قبل إرسال الرسالة";
        message.nextAttemptAt = null;
        await message.save();

        await this.createDeliveryLog(
          message.centerId,
          message.id,
          message.sessionId,
          "permanent_failed",
          "تم إلغاء الحملة قبل إرسال الرسالة",
        );
        return;
      }
    }

    const moduleState = await this.ensureModuleState();
    if (moduleState.status === "paused") {
      await this.markMessageDeferred(
        message,
        message.sessionId,
        "تم إيقاف موديول الواتساب بالكامل مؤقتًا",
      );
      return;
    }

    const session =
      (await WhatsAppSession.findOne({
        where: {
          centerId: message.centerId,
        },
      })) ?? (await this.ensureSession(message.centerId));

    if (!SENDABLE_SESSION_STATUSES.has(session.status)) {
      if (session.status === "disconnected") {
        try {
          await this.connectSession(message.centerId);
        } catch (error) {
          logger.error("تعذر إعادة محاولة ربط جلسة الواتساب قبل الإرسال", {
            centerId: message.centerId,
            error: String(error),
          });
        }
      }

      await this.markMessageDeferred(
        message,
        session.id,
        "الجلسة غير متصلة أو غير مستقرة حاليًا",
      );
      return;
    }

    const attempts = await this.markMessageProcessing(message, session.id);

    if (message.campaignId) {
      const campaign = await WhatsAppCampaign.findByPk(message.campaignId);
      if (campaign && campaign.status === "queued") {
        campaign.status = "running";
        await campaign.save();
      }
    }

    const attachment = (message.metadata as any)?.attachment;

    try {
      const result =
        attachment?.type === "document"
          ? await this.gateway.sendDocument(message.centerId, message.phone, {
              caption: message.renderedBody,
              filePath: String(attachment.filePath ?? ""),
              fileName: String(attachment.fileName ?? "plan.pdf"),
              mimetype: String(attachment.mimetype ?? "application/pdf"),
            })
          : await this.gateway.sendText(message.centerId, message.phone, message.renderedBody);

      await this.markMessageSent(message, session.id, result.messageId);
      if (message.campaignId) {
        await this.syncCampaignStatus(message.campaignId);
      }
    } catch (error) {
      const failure = classifyWhatsAppFailure(error);
      await this.markMessageFailed(message, session.id, failure, attempts);
      if (message.campaignId) {
        await this.syncCampaignStatus(message.campaignId);
      }
      await this.evaluateSessionHealth(message.centerId, session.id);
      await this.evaluateGlobalPauseGuard();
    }
  }

  public async dispatchDueMessages(batchSize = MESSAGE_DISPATCH_BATCH_SIZE) {
    const moduleState = await this.ensureModuleState();
    if (moduleState.status === "paused") {
      return 0;
    }

    const messages = await WhatsAppMessage.findAll({
      where: {
        status: {
          [Op.in]: ["pending", "failed_retryable", "deferred"],
        },
        [Op.or]: [{ nextAttemptAt: null }, { nextAttemptAt: { [Op.lte]: new Date() } }],
      },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
      limit: batchSize,
    });

    for (const message of messages) {
      await this.processMessage(message);
    }

    await this.evaluateGlobalPauseGuard();
    return messages.length;
  }
}

export const whatsAppService = new WhatsAppService();
