import { Application } from "express";
import { authReadFacade } from "../auth";
import { logger } from "../../shared";
import whatsappRoutes from "./whatsapp.routes";
import { whatsAppCommandFacade } from "./whatsapp.facade";
import { whatsAppService } from "./whatsapp.service";

let dispatchIntervalHandle: NodeJS.Timeout | null = null;
let subscriptionReminderIntervalHandle: NodeJS.Timeout | null = null;

const getIntervalMinutes = (
  rawValue: string | undefined,
  fallback: number,
  minimum = 1,
): number => {
  const parsed = Number(rawValue ?? fallback);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
};

export const startWhatsAppJobs = () => {
  if (!dispatchIntervalHandle) {
    const intervalMinutes = getIntervalMinutes(
      process.env.WHATSAPP_DISPATCH_INTERVAL_MINUTES,
      1,
    );

    dispatchIntervalHandle = setInterval(() => {
      void whatsAppService.dispatchDueMessages().catch((error) => {
        logger.error("فشل تشغيل عامل إرسال رسائل واتساب", {
          error: String(error),
        });
      });
    }, intervalMinutes * 60 * 1000);

    if (typeof dispatchIntervalHandle.unref === "function") {
      dispatchIntervalHandle.unref();
    }

    logger.info("تم تشغيل عامل إرسال رسائل واتساب", {
      intervalMinutes,
    });
  }

  if (!subscriptionReminderIntervalHandle) {
    const intervalMinutes = getIntervalMinutes(
      process.env.WHATSAPP_SUBSCRIPTION_REMINDER_INTERVAL_MINUTES,
      360,
    );

    subscriptionReminderIntervalHandle = setInterval(() => {
      void (async () => {
        const centerIds = await authReadFacade.getAllCenterIds();
        if (centerIds.length === 0) {
          return;
        }

        await whatsAppCommandFacade.runSubscriptionExpirySweep();
      })().catch((error) => {
        logger.error("فشل تشغيل مهمة تذكير انتهاء الاشتراكات عبر واتساب", {
          error: String(error),
        });
      });
    }, intervalMinutes * 60 * 1000);

    if (typeof subscriptionReminderIntervalHandle.unref === "function") {
      subscriptionReminderIntervalHandle.unref();
    }

    logger.info("تم تشغيل مهمة تذكير انتهاء الاشتراكات عبر واتساب", {
      intervalMinutes,
    });
  }
};

export const registerWhatsAppModule = (app: Application) => {
  app.use("/api/v1/whatsapp", whatsappRoutes);
};

export { whatsAppCommandFacade };
