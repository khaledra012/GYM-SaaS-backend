import { Op } from "sequelize";
import { AppError, normalizeTimezone } from "../../shared";
import Center, { CenterBillingStatus } from "./auth.model";
import { ensureCenterBillingStatus } from "./center-billing.util";

interface ICenterLookup {
  id: number;
}

export interface ICenterAdminListItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  timezone: string;
  billingStatus: CenterBillingStatus;
  status: CenterBillingStatus;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  trialLabel: string;
  subscriptionStartedAt: Date | null;
  subscriptionEndsAt: Date | null;
  subscriptionDurationDays: number | null;
  subscriptionDaysLeft: number;
  subscriptionDurationLabel: string;
  subscriptionRemainingLabel: string;
  registrationDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IListCentersForAdminInput {
  page: number;
  limit: number;
  billingStatus?: CenterBillingStatus;
  search?: string;
}

export interface IListCentersForAdminResult {
  data: ICenterAdminListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ICenterBillingSummary {
  totalCenters: number;
  trialCenters: number;
  subscribedCenters: number;
  unsubscribedCenters: number;
  trialsExpiringSoon: number;
  subscriptionsExpiringSoon: number;
}

export interface ICenterAuthSnapshot {
  id: number;
  name: string;
  timezone: string;
  billingStatus: CenterBillingStatus;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  subscriptionEndsAt: Date | null;
  subscriptionDaysLeft: number;
}

export interface IUpdateCenterBillingStatusInput {
  centerId: number;
  billingStatus: CenterBillingStatus;
  trialEndsAt?: Date;
  subscriptionEndsAt?: Date;
  subscriptionDurationDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_EXPIRING_SOON_DAYS = 3;
const SUBSCRIPTION_EXPIRING_SOON_DAYS = 3;

const getTrialDaysLeft = (
  billingStatus: CenterBillingStatus,
  trialEndsAt: Date | null,
): number => {
  if (billingStatus !== "trial" || !trialEndsAt) {
    return 0;
  }

  const remaining = trialEndsAt.getTime() - Date.now();
  if (remaining <= 0) {
    return 0;
  }

  return Math.ceil(remaining / DAY_MS);
};

const getSubscriptionDaysLeft = (
  billingStatus: CenterBillingStatus,
  subscriptionEndsAt: Date | null,
): number => {
  if (billingStatus !== "subscribed" || !subscriptionEndsAt) {
    return 0;
  }

  const remaining = subscriptionEndsAt.getTime() - Date.now();
  if (remaining <= 0) {
    return 0;
  }

  return Math.ceil(remaining / DAY_MS);
};

const getSubscriptionDurationDays = (
  subscriptionStartedAt: Date | null,
  subscriptionEndsAt: Date | null,
): number | null => {
  if (!subscriptionStartedAt || !subscriptionEndsAt) {
    return null;
  }

  const duration = subscriptionEndsAt.getTime() - subscriptionStartedAt.getTime();
  if (duration <= 0) {
    return null;
  }

  return Math.ceil(duration / DAY_MS);
};

const getSubscriptionDurationLabel = (
  billingStatus: CenterBillingStatus,
  subscriptionDurationDays: number | null,
  subscriptionEndsAt: Date | null,
): string => {
  if (billingStatus !== "subscribed") {
    return "-";
  }

  if (!subscriptionEndsAt) {
    return "مفتوح";
  }

  if (!subscriptionDurationDays || subscriptionDurationDays <= 0) {
    return "-";
  }

  return `${subscriptionDurationDays} يوم`;
};

const getSubscriptionRemainingLabel = (
  billingStatus: CenterBillingStatus,
  subscriptionDaysLeft: number,
  subscriptionEndsAt: Date | null,
): string => {
  if (billingStatus !== "subscribed") {
    return "-";
  }

  if (!subscriptionEndsAt) {
    return "مفتوح";
  }

  if (subscriptionDaysLeft <= 0) {
    return "منتهي";
  }

  return `متبقي ${subscriptionDaysLeft} يوم`;
};

const getTrialLabel = (
  billingStatus: CenterBillingStatus,
  trialDaysLeft: number,
): string => {
  if (billingStatus !== "trial") {
    return "منتهي";
  }

  if (trialDaysLeft <= 0) {
    return "منتهي";
  }

  return `متبقي ${trialDaysLeft} يوم`;
};

class AuthReadFacade {
  public async getCenterForAccess(centerId: number): Promise<Center | null> {
    const center = await Center.findByPk(centerId);
    if (!center) {
      return null;
    }

    await ensureCenterBillingStatus(center);
    center.timezone = normalizeTimezone(center.timezone);
    return center;
  }

  public mapCenterAuthSnapshot(center: Center): ICenterAuthSnapshot {
    return {
      id: center.id,
      name: center.name,
      timezone: normalizeTimezone(center.timezone),
      billingStatus: center.billingStatus,
      trialEndsAt: center.trialEndsAt ?? null,
      trialDaysLeft: getTrialDaysLeft(center.billingStatus, center.trialEndsAt ?? null),
      subscriptionEndsAt: center.subscriptionEndsAt ?? null,
      subscriptionDaysLeft: getSubscriptionDaysLeft(
        center.billingStatus,
        center.subscriptionEndsAt ?? null,
      ),
    };
  }

  private mapAdminCenter(center: Center): ICenterAdminListItem {
    const trialDaysLeft = getTrialDaysLeft(center.billingStatus, center.trialEndsAt ?? null);
    const subscriptionDurationDays = getSubscriptionDurationDays(
      center.subscriptionStartedAt ?? null,
      center.subscriptionEndsAt ?? null,
    );
    const subscriptionDaysLeft = getSubscriptionDaysLeft(
      center.billingStatus,
      center.subscriptionEndsAt ?? null,
    );

    return {
      id: center.id,
      name: center.name,
      email: center.email,
      phone: center.phone ?? null,
      timezone: center.timezone,
      billingStatus: center.billingStatus,
      status: center.billingStatus,
      trialStartedAt: center.trialStartedAt ?? null,
      trialEndsAt: center.trialEndsAt ?? null,
      trialDaysLeft,
      trialLabel: getTrialLabel(center.billingStatus, trialDaysLeft),
      subscriptionStartedAt: center.subscriptionStartedAt ?? null,
      subscriptionEndsAt: center.subscriptionEndsAt ?? null,
      subscriptionDurationDays,
      subscriptionDaysLeft,
      subscriptionDurationLabel: getSubscriptionDurationLabel(
        center.billingStatus,
        subscriptionDurationDays,
        center.subscriptionEndsAt ?? null,
      ),
      subscriptionRemainingLabel: getSubscriptionRemainingLabel(
        center.billingStatus,
        subscriptionDaysLeft,
        center.subscriptionEndsAt ?? null,
      ),
      registrationDate: center.createdAt,
      createdAt: center.createdAt,
      updatedAt: center.updatedAt,
    };
  }

  public async getAllCenterIds(): Promise<number[]> {
    const centers = await Center.findAll({
      attributes: ["id"],
      raw: true,
    });

    return (centers as ICenterLookup[])
      .map((center) => Number(center.id))
      .filter((centerId) => Number.isInteger(centerId) && centerId > 0);
  }

  public async expireDueTrials(): Promise<number> {
    const [affectedRows] = await Center.update(
      {
        billingStatus: "unsubscribed",
        trialStartedAt: null,
        trialEndsAt: null,
      },
      {
        where: {
          billingStatus: "trial",
          trialEndsAt: {
            [Op.lte]: new Date(),
          },
        },
      },
    );

    return affectedRows;
  }

  public async expireDueSubscriptions(): Promise<number> {
    const [affectedRows] = await Center.update(
      {
        billingStatus: "unsubscribed",
        subscriptionStartedAt: null,
        subscriptionEndsAt: null,
      },
      {
        where: {
          billingStatus: "subscribed",
          subscriptionEndsAt: {
            [Op.lte]: new Date(),
          },
        },
      },
    );

    return affectedRows;
  }

  public async expireDueBillingStatuses(): Promise<number> {
    const [trialAffected, subscriptionAffected] = await Promise.all([
      this.expireDueTrials(),
      this.expireDueSubscriptions(),
    ]);

    return trialAffected + subscriptionAffected;
  }

  public async listCentersForAdmin(
    input: IListCentersForAdminInput,
  ): Promise<IListCentersForAdminResult> {
    const where: any = {};

    if (input.billingStatus) {
      where.billingStatus = input.billingStatus;
    }

    if (input.search) {
      const searchLike = `%${input.search}%`;
      where[Op.or] = [
        { name: { [Op.like]: searchLike } },
        { email: { [Op.like]: searchLike } },
        { phone: { [Op.like]: searchLike } },
      ];
    }

    const offset = (input.page - 1) * input.limit;

    const { rows, count } = await Center.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset,
      limit: input.limit,
    });

    return {
      data: rows.map((center) => this.mapAdminCenter(center)),
      total: count,
      page: input.page,
      limit: input.limit,
      pages: Math.max(1, Math.ceil(count / input.limit)),
    };
  }

  public async getCentersBillingSummary(): Promise<ICenterBillingSummary> {
    const now = new Date();
    const trialSoonLimit = new Date(now.getTime() + TRIAL_EXPIRING_SOON_DAYS * DAY_MS);
    const subscriptionSoonLimit = new Date(
      now.getTime() + SUBSCRIPTION_EXPIRING_SOON_DAYS * DAY_MS,
    );

    const [
      totalCenters,
      trialCenters,
      subscribedCenters,
      unsubscribedCenters,
      trialsExpiringSoon,
      subscriptionsExpiringSoon,
    ] = await Promise.all([
      Center.count(),
      Center.count({ where: { billingStatus: "trial" } }),
      Center.count({ where: { billingStatus: "subscribed" } }),
      Center.count({ where: { billingStatus: "unsubscribed" } }),
      Center.count({
        where: {
          billingStatus: "trial",
          trialEndsAt: {
            [Op.gt]: now,
            [Op.lte]: trialSoonLimit,
          },
        },
      }),
      Center.count({
        where: {
          billingStatus: "subscribed",
          subscriptionEndsAt: {
            [Op.gt]: now,
            [Op.lte]: subscriptionSoonLimit,
          },
        },
      }),
    ]);

    return {
      totalCenters,
      trialCenters,
      subscribedCenters,
      unsubscribedCenters,
      trialsExpiringSoon,
      subscriptionsExpiringSoon,
    };
  }

  public async updateCenterBillingStatus(
    input: IUpdateCenterBillingStatusInput,
  ): Promise<ICenterAdminListItem> {
    const center = await Center.findByPk(input.centerId);
    if (!center) {
      throw new AppError("ظ„ط§ ظٹظˆط¬ط¯ ط¬ظٹظ… ط¨ظ‡ط°ط§ ط§ظ„ظ…ط¹ط±ظپ", 404);
    }

    if (input.billingStatus === "trial") {
      if (input.subscriptionEndsAt || input.subscriptionDurationDays !== undefined) {
        throw new AppError("ظ„ط§ ظٹظ…ظƒظ† طھط­ط¯ظٹط¯ ظ…ط¯ط© طھظپط¹ظٹظ„ ظ…ط¯ظپظˆط¹ ظ…ط¹ ط­ط§ظ„ط© trial", 400);
      }

      const trialStartedAt = new Date();
      const trialEndsAt =
        input.trialEndsAt ?? new Date(trialStartedAt.getTime() + 15 * DAY_MS);

      if (trialEndsAt.getTime() <= trialStartedAt.getTime()) {
        throw new AppError("طھط§ط±ظٹط® ظ†ظ‡ط§ظٹط© ط§ظ„طھط¬ط±ط¨ط© ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط¨ط¹ط¯ طھط§ط±ظٹط® ط§ظ„ط¨ط¯ط§ظٹط©", 400);
      }

      center.billingStatus = "trial";
      center.trialStartedAt = trialStartedAt;
      center.trialEndsAt = trialEndsAt;
      center.subscriptionStartedAt = null;
      center.subscriptionEndsAt = null;
    } else if (input.billingStatus === "subscribed") {
      if (input.trialEndsAt) {
        throw new AppError("ظ„ط§ ظٹظ…ظƒظ† ط¥ط±ط³ط§ظ„ trialEndsAt ظ…ط¹ ط­ط§ظ„ط© subscribed", 400);
      }

      if (input.subscriptionEndsAt && input.subscriptionDurationDays !== undefined) {
        throw new AppError("ط§ط®طھط± ظ…ط¯ط© ط¨ط§ظ„ط£ظٹط§ظ… ط£ظˆ طھط§ط±ظٹط® ظ†ظ‡ط§ظٹط©طŒ ظˆظ„ظٹط³ ط§ظ„ط§ط«ظ†ظٹظ† ظ…ط¹ظ‹ط§", 400);
      }

      const subscriptionStartedAt = new Date();
      let subscriptionEndsAt: Date | null = null;

      if (input.subscriptionDurationDays !== undefined) {
        if (!Number.isInteger(input.subscriptionDurationDays) || input.subscriptionDurationDays <= 0) {
          throw new AppError("ظ…ط¯ط© ط§ظ„طھظپط¹ظٹظ„ ط¨ط§ظ„ط£ظٹط§ظ… ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ط±ظ‚ظ…ظ‹ط§ طµط­ظٹط­ظ‹ط§ ط£ظƒط¨ط± ظ…ظ† طµظپط±", 400);
        }

        subscriptionEndsAt = new Date(
          subscriptionStartedAt.getTime() + input.subscriptionDurationDays * DAY_MS,
        );
      } else if (input.subscriptionEndsAt) {
        subscriptionEndsAt = input.subscriptionEndsAt;
      }

      if (
        subscriptionEndsAt &&
        (Number.isNaN(subscriptionEndsAt.getTime()) ||
          subscriptionEndsAt.getTime() <= subscriptionStartedAt.getTime())
      ) {
        throw new AppError("طھط§ط±ظٹط® ظ†ظ‡ط§ظٹط© ط§ظ„طھظپط¹ظٹظ„ ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظپظٹ ط§ظ„ظ…ط³طھظ‚ط¨ظ„", 400);
      }

      center.billingStatus = "subscribed";
      center.subscriptionStartedAt = subscriptionStartedAt;
      center.subscriptionEndsAt = subscriptionEndsAt;
      center.trialStartedAt = null;
      center.trialEndsAt = null;
    } else {
      center.billingStatus = "unsubscribed";
      center.trialStartedAt = null;
      center.trialEndsAt = null;
      center.subscriptionStartedAt = null;
      center.subscriptionEndsAt = null;
    }

    await center.save({ validate: false });

    return this.mapAdminCenter(center);
  }
}

export const authReadFacade = new AuthReadFacade();

