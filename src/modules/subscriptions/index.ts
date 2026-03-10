import { Application } from "express";
import subscriptionRoutes from "./subscription.routes";
import { subscriptionService } from "./subscription.service";
import { authReadFacade } from "../auth";
import { logger } from "../../shared";

let autoExpireIntervalHandle: NodeJS.Timeout | null = null;

const getAutoExpireIntervalMinutes = (): number => {
  const configured = Number(
    process.env.SUBSCRIPTION_AUTO_EXPIRE_INTERVAL_MINUTES ?? 15,
  );

  if (!Number.isFinite(configured) || configured < 1) {
    return 15;
  }

  return configured;
};

export const startSubscriptionAutoExpireJob = () => {
  if (autoExpireIntervalHandle) return;

  const intervalMinutes = getAutoExpireIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  const runAutoExpire = async () => {
    try {
      const centerIds = await authReadFacade.getAllCenterIds();
      if (centerIds.length === 0) return;

      let totalExpired = 0;
      for (const centerId of centerIds) {
        const result = await subscriptionService.autoExpire(centerId);
        totalExpired += result.count;
      }

      if (totalExpired > 0) {
        logger.info("تم إنهاء الاشتراكات المنتهية تلقائيًا", {
          count: totalExpired,
        });
      }
    } catch (error) {
      logger.error("فشل تشغيل مهمة إنهاء الاشتراكات التلقائية", {
        error: String(error),
      });
    }
  };

  autoExpireIntervalHandle = setInterval(() => {
    void runAutoExpire();
  }, intervalMs);

  if (typeof autoExpireIntervalHandle.unref === "function") {
    autoExpireIntervalHandle.unref();
  }

  logger.info("تم تشغيل مهمة إنهاء الاشتراكات التلقائية", {
    intervalMinutes,
  });
};

export const registerSubscriptionModule = (app: Application) => {
  app.use("/api/v1/subscriptions", subscriptionRoutes);
};

export { subscriptionReadFacade, subscriptionCommandFacade } from "./subscription.facade";
export type {
  IMemberSubscriptionSnapshot,
  SessionConsumeDenyReasonCode,
} from "./subscription.facade";
