import { Op } from "sequelize";
import sequelize from "../../config/db.config";
import { AppError, logger } from "../../shared";
import { memberReadFacade } from "../member";
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
  ICreateWhatsAppTemplateDTO,
  IListWhatsAppMessagesQuery,
  IUpdateWhatsAppOptInDTO,
  IUpdateWhatsAppTemplateDTO,
} from "./whatsapp.schema";
import {
  WhatsAppDeliveryStatus,
  WhatsAppMessageStatus,
  WhatsAppTemplateEventType,
} from "./whatsapp.types";
import {
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
  dedupeKey?: string | null;
  templateBody?: string;
  requireOptIn?: boolean;
  variables: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown> | null;
}

interface IQueueTemplateMessageResult {
  queued: boolean;
  reason?: string;
  alreadyQueued?: boolean;
  message: any | null;
}

const GLOBAL_SCOPE_KEY = "global";
const MAX_SEND_ATTEMPTS = 3;
const GLOBAL_HEALTH_WINDOW_MS = 15 * 60 * 1000;
const MESSAGE_DISPATCH_BATCH_SIZE = 5;
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

  private async releaseDeferredMessages(centerId?: number) {
    const where: any = {
      status: "deferred",
    };

    if (centerId) {
      where.centerId = centerId;
    }

    await WhatsAppMessage.update(
      {
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
      eventType: input.eventType,
      templateId: resolvedTemplate.templateId,
      dedupeKey: input.dedupeKey ?? null,
      phone: normalizedPhone,
      renderedBody,
      status: "pending",
      nextAttemptAt: new Date(),
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

    try {
      const result = await this.gateway.sendText(
        message.centerId,
        message.phone,
        message.renderedBody,
      );

      await this.markMessageSent(message, session.id, result.messageId);
    } catch (error) {
      const failure = classifyWhatsAppFailure(error);
      await this.markMessageFailed(message, session.id, failure, attempts);
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
