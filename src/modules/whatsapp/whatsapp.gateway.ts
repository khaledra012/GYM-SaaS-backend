import fs from "fs/promises";
import path from "path";
import { AppError, logger } from "../../shared";
import { toWhatsAppJid } from "./whatsapp.util";

export interface IWhatsAppGatewaySessionUpdate {
  status:
    | "connecting"
    | "qr_ready"
    | "connected"
    | "degraded"
    | "paused"
    | "disconnected";
  phone?: string | null;
  qrCodeDataUrl?: string | null;
  pauseReason?: string | null;
  metadata?: Record<string, unknown> | null;
  lastConnectedAt?: Date | null;
  lastDisconnectedAt?: Date | null;
  lastQrAt?: Date | null;
}

interface IWhatsAppGatewayRuntime {
  socket: any;
  reconnectHandle: NodeJS.Timeout | null;
}

interface ILoadedLibraries {
  baileys: any;
  qrcode: any;
}

interface ITrackedDocumentMessage {
  messageId: string;
  phone: string;
  fileName: string;
  trackedAt: number;
}

const RECONNECT_DELAY_MS = 10_000;
const TRACKED_DOCUMENT_TTL_MS = 6 * 60 * 60 * 1000;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const resolveAuthRootDirectory = (): string => {
  const configured = String(process.env.WHATSAPP_AUTH_DIR ?? "").trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.join(process.cwd(), "storage", "whatsapp");
};

export class WhatsAppGateway {
  private runtimes = new Map<number, IWhatsAppGatewayRuntime>();
  private manualDisconnects = new Set<number>();
  private trackedDocumentMessages = new Map<number, Map<string, ITrackedDocumentMessage>>();
  private libraries: ILoadedLibraries | null = null;
  private readonly authRootDirectory = resolveAuthRootDirectory();

  constructor(
    private readonly onSessionUpdate: (
      centerId: number,
      update: IWhatsAppGatewaySessionUpdate,
    ) => Promise<void>,
  ) {}

  private loadLibraries(): ILoadedLibraries {
    if (this.libraries) {
      return this.libraries;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const baileys = require("@whiskeysockets/baileys");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const qrcode = require("qrcode");

      this.libraries = {
        baileys,
        qrcode,
      };

      return this.libraries;
    } catch (error) {
      throw new AppError(
        `مكتبات موديول الواتساب غير مثبتة بعد. شغّل npm install لتثبيت Baileys و qrcode. (${String(
          error,
        )})`,
        500,
      );
    }
  }

  private getSessionDirectory(centerId: number): string {
    return path.join(this.authRootDirectory, String(centerId));
  }

  private clearReconnectHandle(centerId: number) {
    const runtime = this.runtimes.get(centerId);
    if (!runtime?.reconnectHandle) {
      return;
    }

    clearTimeout(runtime.reconnectHandle);
    runtime.reconnectHandle = null;
  }

  private safeStringify(value: unknown, maxLength = 2000): string | null {
    try {
      const json = JSON.stringify(value);
      if (!json) {
        return null;
      }

      return json.length > maxLength ? `${json.slice(0, maxLength)}...` : json;
    } catch {
      return null;
    }
  }

  private pruneTrackedDocumentMessages(centerId: number) {
    const scopedMap = this.trackedDocumentMessages.get(centerId);
    if (!scopedMap || scopedMap.size === 0) {
      return;
    }

    const cutoff = Date.now() - TRACKED_DOCUMENT_TTL_MS;
    for (const [messageId, entry] of scopedMap.entries()) {
      if (entry.trackedAt < cutoff) {
        scopedMap.delete(messageId);
      }
    }

    if (scopedMap.size === 0) {
      this.trackedDocumentMessages.delete(centerId);
    }
  }

  private trackDocumentMessage(
    centerId: number,
    messageId: string,
    payload: { phone: string; fileName: string },
  ) {
    this.pruneTrackedDocumentMessages(centerId);

    const scopedMap =
      this.trackedDocumentMessages.get(centerId) ??
      new Map<string, ITrackedDocumentMessage>();

    scopedMap.set(messageId, {
      messageId,
      phone: payload.phone,
      fileName: payload.fileName,
      trackedAt: Date.now(),
    });

    this.trackedDocumentMessages.set(centerId, scopedMap);
  }

  private getTrackedDocumentMessage(centerId: number, messageId: string) {
    this.pruneTrackedDocumentMessages(centerId);
    return this.trackedDocumentMessages.get(centerId)?.get(messageId) ?? null;
  }

  private async scheduleReconnect(centerId: number) {
    const existing = this.runtimes.get(centerId);
    if (!existing || existing.reconnectHandle) {
      return;
    }

    existing.reconnectHandle = setTimeout(() => {
      void this.reconnect(centerId);
    }, RECONNECT_DELAY_MS);

    if (typeof existing.reconnectHandle.unref === "function") {
      existing.reconnectHandle.unref();
    }
  }

  private async reconnect(centerId: number) {
    const existing = this.runtimes.get(centerId);
    if (existing?.socket) {
      try {
        existing.socket.end?.();
      } catch {
        // ignore
      }
    }

    this.runtimes.delete(centerId);

    try {
      await this.connect(centerId);
    } catch (error) {
      logger.error("فشل إعادة ربط جلسة واتساب", {
        centerId,
        error: String(error),
      });
    }
  }

  private async clearSessionDirectory(centerId: number) {
    const sessionDirectory = this.getSessionDirectory(centerId);
    await fs.rm(sessionDirectory, { recursive: true, force: true });
    logger.info("تمت إعادة ضبط ملفات جلسة واتساب", {
      centerId,
      sessionDirectory,
    });
  }

  private async handleConnectionUpdate(
    centerId: number,
    update: any,
  ): Promise<void> {
    const { baileys, qrcode } = this.loadLibraries();
    const runtime = this.runtimes.get(centerId);
    if (!runtime) {
      return;
    }

    if (update?.qr) {
      const qrCodeDataUrl = await qrcode.toDataURL(update.qr);
      await this.onSessionUpdate(centerId, {
        status: "qr_ready",
        qrCodeDataUrl,
        pauseReason: null,
        lastQrAt: new Date(),
      });
    }

    if (update?.connection === "open") {
      this.clearReconnectHandle(centerId);

      const rawUserId = String(runtime.socket?.user?.id ?? "");
      const phone = rawUserId.split(":")[0]?.replace(/\D/g, "") || null;

      logger.info("تم فتح جلسة واتساب بنجاح", {
        centerId,
        phone,
        userId: rawUserId || null,
      });

      await this.onSessionUpdate(centerId, {
        status: "connected",
        phone,
        qrCodeDataUrl: null,
        pauseReason: null,
        lastConnectedAt: new Date(),
        metadata: {
          userId: rawUserId || null,
        },
      });
      return;
    }

    if (update?.connection === "close") {
      const disconnectStatusCode = Number(
        update?.lastDisconnect?.error?.output?.statusCode ??
          update?.lastDisconnect?.error?.statusCode ??
          0,
      );
      const disconnectMessage = String(
        update?.lastDisconnect?.error?.message ??
          update?.lastDisconnect?.error ??
          "",
      );

      const isLoggedOut =
        disconnectStatusCode === Number(baileys?.DisconnectReason?.loggedOut);
      const isManualDisconnect = this.manualDisconnects.has(centerId);

      logger.warn("تم إغلاق جلسة واتساب", {
        centerId,
        disconnectStatusCode,
        disconnectMessage: disconnectMessage || null,
        isLoggedOut,
        isManualDisconnect,
      });

      await this.onSessionUpdate(centerId, {
        status: "disconnected",
        qrCodeDataUrl: null,
        pauseReason: isLoggedOut ? "تم تسجيل الخروج من واتساب" : null,
        lastDisconnectedAt: new Date(),
      });

      if (isLoggedOut) {
        this.clearReconnectHandle(centerId);
        this.runtimes.delete(centerId);

        if (isManualDisconnect) {
          this.manualDisconnects.delete(centerId);
          return;
        }

        try {
          await this.clearSessionDirectory(centerId);
          await this.connect(centerId);
        } catch (error) {
          logger.error("تعذر تجهيز جلسة واتساب جديدة بعد تسجيل الخروج", {
            centerId,
            error: String(error),
          });
        }

        return;
      }

      await this.scheduleReconnect(centerId);
    }
  }

  private async buildRuntime(centerId: number): Promise<IWhatsAppGatewayRuntime> {
    const { baileys } = this.loadLibraries();

    const sessionDirectory = this.getSessionDirectory(centerId);
    await fs.mkdir(sessionDirectory, { recursive: true });
    logger.info("تم تجهيز مسار تخزين جلسة واتساب", {
      centerId,
      sessionDirectory,
    });

    const { state, saveCreds } = await baileys.useMultiFileAuthState(
      sessionDirectory,
    );
    const latestVersion = await baileys.fetchLatestBaileysVersion();

    const socket = baileys.default({
      auth: state,
      version: latestVersion?.version,
      printQRInTerminal: false,
      browser: ["Gym SaaS", "Chrome", "1.0.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    socket.ev.on("creds.update", () => {
      void saveCreds();
    });

    socket.ev.on("connection.update", (connectionUpdate: any) => {
      void this.handleConnectionUpdate(centerId, connectionUpdate);
    });

    socket.ev.on("messages.update", (updates: any) => {
      const normalizedUpdates = Array.isArray(updates) ? updates : [];

      for (const update of normalizedUpdates) {
        const messageId = String(update?.key?.id ?? "").trim();
        if (!messageId) {
          continue;
        }

        const trackedMessage = this.getTrackedDocumentMessage(centerId, messageId);
        if (!trackedMessage) {
          continue;
        }

        logger.info("WhatsApp document message update received", {
          centerId,
          messageId,
          phone: trackedMessage.phone,
          fileName: trackedMessage.fileName,
          status: update?.update?.status ?? update?.status ?? null,
          payload: this.safeStringify(update),
        });
      }
    });

    socket.ev.on("message-receipt.update", (updates: any) => {
      const normalizedUpdates = Array.isArray(updates) ? updates : [];

      for (const update of normalizedUpdates) {
        const messageId = String(update?.key?.id ?? "").trim();
        if (!messageId) {
          continue;
        }

        const trackedMessage = this.getTrackedDocumentMessage(centerId, messageId);
        if (!trackedMessage) {
          continue;
        }

        logger.info("WhatsApp document receipt update received", {
          centerId,
          messageId,
          phone: trackedMessage.phone,
          fileName: trackedMessage.fileName,
          payload: this.safeStringify(update),
        });
      }
    });

    return {
      socket,
      reconnectHandle: null,
    };
  }

  public async connect(centerId: number): Promise<void> {
    if (this.runtimes.has(centerId)) {
      return;
    }

    await this.onSessionUpdate(centerId, {
      status: "connecting",
      pauseReason: null,
    });

    const runtime = await this.buildRuntime(centerId);
    this.runtimes.set(centerId, runtime);
  }

  public async disconnect(centerId: number): Promise<void> {
    const runtime = this.runtimes.get(centerId);
    if (runtime) {
      this.clearReconnectHandle(centerId);
      this.manualDisconnects.add(centerId);

      try {
        await runtime.socket.logout?.();
      } catch {
        try {
          runtime.socket.end?.();
        } catch {
          // ignore
        }
      }

      this.runtimes.delete(centerId);
    }

    this.manualDisconnects.delete(centerId);

    await this.onSessionUpdate(centerId, {
      status: "disconnected",
      qrCodeDataUrl: null,
      pauseReason: null,
      lastDisconnectedAt: new Date(),
    });
  }

  public async sendText(
    centerId: number,
    phone: string,
    text: string,
  ): Promise<{ messageId: string | null }> {
    let runtime = this.runtimes.get(centerId);
    if (!runtime) {
      await this.connect(centerId);
      runtime = this.runtimes.get(centerId);
    }

    if (!runtime?.socket) {
      const error = new Error("جلسة الواتساب غير متاحة حالياً");
      (error as any).code = "session_unavailable";
      throw error;
    }

    if (!runtime.socket.user) {
      const error = new Error("الجلسة غير متصلة حالياً");
      (error as any).code = "session_unavailable";
      throw error;
    }

    const jid = toWhatsAppJid(phone);
    if (!jid) {
      const error = new Error("رقم الهاتف غير صالح للإرسال");
      (error as any).code = "invalid_phone";
      throw error;
    }

    await runtime.socket.sendPresenceUpdate("available", jid);
    await delay(1_000 + Math.floor(Math.random() * 1_500));
    await runtime.socket.sendPresenceUpdate("composing", jid);
    await delay(2_000 + Math.floor(Math.random() * 2_000));

    const response = await runtime.socket.sendMessage(jid, { text });

    return {
      messageId: response?.key?.id ?? null,
    };
  }

  private buildOutboundDocumentFileName(
    fileName: string,
    mimetype: string,
  ): string {
    const trimmedName = String(fileName ?? "").trim();
    const fallbackExtension = mimetype === "application/pdf" ? ".pdf" : "";
    const rawExtension = path.extname(trimmedName);
    const extension = rawExtension || fallbackExtension;
    const baseName = trimmedName
      ? path.basename(trimmedName, rawExtension)
      : "attachment";

    const safeBaseName = baseName
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "-")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);

    return `${safeBaseName || "attachment"}${extension}`;
  }

  private hasDocumentPayload(response: any): boolean {
    const responseMessage = response?.message;

    return Boolean(
      responseMessage?.documentMessage ||
        responseMessage?.documentWithCaptionMessage,
    );
  }

  public async sendDocument(
    centerId: number,
    phone: string,
    input: {
      caption: string;
      filePath: string;
      fileName: string;
      mimetype: string;
    },
  ): Promise<{ messageId: string | null }> {
    let runtime = this.runtimes.get(centerId);
    if (!runtime) {
      await this.connect(centerId);
      runtime = this.runtimes.get(centerId);
    }

    if (!runtime?.socket) {
      const error = new Error("جلسة الواتساب غير متاحة حالياً");
      (error as any).code = "session_unavailable";
      throw error;
    }

    if (!runtime.socket.user) {
      const error = new Error("الجلسة غير متصلة حالياً");
      (error as any).code = "session_unavailable";
      throw error;
    }

    const jid = toWhatsAppJid(phone);
    if (!jid) {
      const error = new Error("رقم الهاتف غير صالح للإرسال");
      (error as any).code = "invalid_phone";
      throw error;
    }

    let fileStats: Awaited<ReturnType<typeof fs.stat>>;

    try {
      fileStats = await fs.stat(input.filePath);
    } catch {
      const error = new Error("ملف الخطة المطلوب إرساله غير موجود");
      (error as any).code = "attachment_missing";
      throw error;
    }

    if (!fileStats.isFile() || fileStats.size <= 0) {
      const error = new Error("ملف الخطة فارغ ولا يمكن إرساله");
      (error as any).code = "attachment_missing";
      throw error;
    }

    await runtime.socket.sendPresenceUpdate("available", jid);
    await delay(1_000 + Math.floor(Math.random() * 1_500));

    const outboundFileName = this.buildOutboundDocumentFileName(
      input.fileName,
      input.mimetype,
    );
    const response = await runtime.socket.sendMessage(jid, {
      document: {
        url: input.filePath,
      },
      fileName: outboundFileName,
      mimetype: input.mimetype,
    });

    const messageId = String(response?.key?.id ?? "").trim() || null;
    const hasDocumentPayload = this.hasDocumentPayload(response);

    if (messageId) {
      this.trackDocumentMessage(centerId, messageId, {
        phone,
        fileName: outboundFileName,
      });
    }

    logger.info("WhatsApp document send response captured", {
      centerId,
      phone,
      filePath: input.filePath,
      fileName: outboundFileName,
      messageId,
      hasDocumentPayload,
      responseEnvelopeKeys: response ? Object.keys(response) : [],
      responseMessageKeys: response?.message ? Object.keys(response.message) : [],
      responsePreview: this.safeStringify(response),
    });

    if (!hasDocumentPayload) {
      logger.error("لم يرجع Baileys تأكيداً لإرسال الملف كمستند", {
        centerId,
        fileName: outboundFileName,
        filePath: input.filePath,
        responseKeys: response?.message ? Object.keys(response.message) : [],
      });

      const error = new Error("تعذر إرسال ملف الخطة كمستند عبر واتساب");
      (error as any).code = "document_not_sent";
      throw error;
    }

    return {
      messageId,
    };
  }
}
