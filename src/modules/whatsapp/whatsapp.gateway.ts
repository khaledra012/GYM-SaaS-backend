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

const RECONNECT_DELAY_MS = 10_000;

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
        `Ù…ÙƒØªØ¨Ø§Øª Ù…ÙˆØ¯ÙŠÙˆÙ„ Ø§Ù„ÙˆØ§ØªØ³Ø§Ø¨ ØºÙŠØ± Ù…Ø«Ø¨ØªØ© Ø¨Ø¹Ø¯. Ø´ØºÙ‘Ù„ npm install Ù„ØªØ«Ø¨ÙŠØª Baileys Ùˆ qrcode. (${String(
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
      logger.error("ÙØ´Ù„ Ø¥Ø¹Ø§Ø¯Ø© Ø±Ø¨Ø· Ø¬Ù„Ø³Ø© ÙˆØ§ØªØ³Ø§Ø¨", {
        centerId,
        error: String(error),
      });
    }
  }

  private async clearSessionDirectory(centerId: number) {
    const sessionDirectory = this.getSessionDirectory(centerId);
    await fs.rm(sessionDirectory, { recursive: true, force: true });
    logger.info("ØªÙ…Øª Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø· Ù…Ù„ÙØ§Øª Ø¬Ù„Ø³Ø© ÙˆØ§ØªØ³Ø§Ø¨", {
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

      logger.info("ØªÙ… ÙØªØ­ Ø¬Ù„Ø³Ø© ÙˆØ§ØªØ³Ø§Ø¨ Ø¨Ù†Ø¬Ø§Ø­", {
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

      logger.warn("ØªÙ… Ø¥ØºÙ„Ø§Ù‚ Ø¬Ù„Ø³Ø© ÙˆØ§ØªØ³Ø§Ø¨", {
        centerId,
        disconnectStatusCode,
        disconnectMessage: disconnectMessage || null,
        isLoggedOut,
        isManualDisconnect,
      });

      await this.onSessionUpdate(centerId, {
        status: "disconnected",
        qrCodeDataUrl: null,
        pauseReason: isLoggedOut ? "ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ Ù…Ù† ÙˆØ§ØªØ³Ø§Ø¨" : null,
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
          logger.error("ØªØ¹Ø°Ø± ØªØ¬Ù‡ÙŠØ² Ø¬Ù„Ø³Ø© ÙˆØ§ØªØ³Ø§Ø¨ Ø¬Ø¯ÙŠØ¯Ø© Ø¨Ø¹Ø¯ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬", {
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
    logger.info("ØªÙ… ØªØ¬Ù‡ÙŠØ² Ù…Ø³Ø§Ø± ØªØ®Ø²ÙŠÙ† Ø¬Ù„Ø³Ø© ÙˆØ§ØªØ³Ø§Ø¨", {
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
      const error = new Error("Ø¬Ù„Ø³Ø© Ø§Ù„ÙˆØ§ØªØ³Ø§Ø¨ ØºÙŠØ± Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠÙ‹Ø§");
      (error as any).code = "session_unavailable";
      throw error;
    }

    if (!runtime.socket.user) {
      const error = new Error("Ø§Ù„Ø¬Ù„Ø³Ø© ØºÙŠØ± Ù…ØªØµÙ„Ø© Ø­Ø§Ù„ÙŠÙ‹Ø§");
      (error as any).code = "session_unavailable";
      throw error;
    }

    const jid = toWhatsAppJid(phone);
    if (!jid) {
      const error = new Error("Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ ØºÙŠØ± ØµØ§Ù„Ø­ Ù„Ù„Ø¥Ø±Ø³Ø§Ù„");
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
      const error = new Error("ÌáÓÉ ÇáæÇÊÓÇÈ ÛíÑ ãÊÇÍÉ ÍÇáíÇğ");
      (error as any).code = "session_unavailable";
      throw error;
    }

    if (!runtime.socket.user) {
      const error = new Error("ÇáÌáÓÉ ÛíÑ ãÊÕáÉ ÍÇáíÇğ");
      (error as any).code = "session_unavailable";
      throw error;
    }

    const jid = toWhatsAppJid(phone);
    if (!jid) {
      const error = new Error("ÑŞã ÇáåÇÊİ ÛíÑ ÕÇáÍ ááÅÑÓÇá");
      (error as any).code = "invalid_phone";
      throw error;
    }

    let fileBuffer: Buffer;

    try {
      fileBuffer = await fs.readFile(input.filePath);
    } catch {
      const error = new Error("ãáİ ÇáÎØÉ ÇáãØáæÈ ÅÑÓÇáå ÛíÑ ãæÌæÏ");
      (error as any).code = "attachment_missing";
      throw error;
    }

    if (!fileBuffer.length) {
      const error = new Error("ãáİ ÇáÎØÉ İÇÑÛ æáÇ íãßä ÅÑÓÇáå");
      (error as any).code = "attachment_missing";
      throw error;
    }

    await runtime.socket.sendPresenceUpdate("available", jid);
    await delay(1_000 + Math.floor(Math.random() * 1_500));

    const response = await runtime.socket.sendMessage(jid, {
      document: fileBuffer,
      caption: input.caption,
      fileName: input.fileName,
      mimetype: input.mimetype,
    });

    const responseMessage = response?.message;
    const hasDocumentPayload = Boolean(
      responseMessage?.documentMessage ||
        responseMessage?.documentWithCaptionMessage,
    );

    if (!hasDocumentPayload) {
      logger.error("áã íÑÌÚ Baileys ÊÃßíÏÇğ áÅÑÓÇá Çáãáİ ßãÓÊäÏ", {
        centerId,
        fileName: input.fileName,
        filePath: input.filePath,
        responseKeys: responseMessage ? Object.keys(responseMessage) : [],
      });

      const error = new Error("ÊÚĞÑ ÅÑÓÇá ãáİ ÇáÎØÉ ßãÓÊäÏ ÚÈÑ æÇÊÓÇÈ");
      (error as any).code = "document_not_sent";
      throw error;
    }

    return {
      messageId: response?.key?.id ?? null,
    };
  }
}

