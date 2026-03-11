import { Op } from "sequelize";
import { AppError } from "../../shared";
import Center, { CenterBillingStatus } from "./auth.model";

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
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
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
}

export interface IUpdateCenterBillingStatusInput {
  centerId: number;
  billingStatus: CenterBillingStatus;
  trialEndsAt?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_EXPIRING_SOON_DAYS = 3;

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

class AuthReadFacade {
  private mapAdminCenter(center: Center): ICenterAdminListItem {
    return {
      id: center.id,
      name: center.name,
      email: center.email,
      phone: center.phone ?? null,
      timezone: center.timezone,
      billingStatus: center.billingStatus,
      trialStartedAt: center.trialStartedAt ?? null,
      trialEndsAt: center.trialEndsAt ?? null,
      trialDaysLeft: getTrialDaysLeft(center.billingStatus, center.trialEndsAt ?? null),
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
    const soonLimit = new Date(now.getTime() + TRIAL_EXPIRING_SOON_DAYS * DAY_MS);

    const [
      totalCenters,
      trialCenters,
      subscribedCenters,
      unsubscribedCenters,
      trialsExpiringSoon,
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
            [Op.lte]: soonLimit,
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
    };
  }

  public async updateCenterBillingStatus(
    input: IUpdateCenterBillingStatusInput,
  ): Promise<ICenterAdminListItem> {
    const center = await Center.findByPk(input.centerId);
    if (!center) {
      throw new AppError("لا يوجد جيم بهذا المعرف", 404);
    }

    if (input.billingStatus === "trial") {
      const trialStartedAt = new Date();
      const trialEndsAt =
        input.trialEndsAt ?? new Date(trialStartedAt.getTime() + 15 * DAY_MS);

      if (trialEndsAt.getTime() <= trialStartedAt.getTime()) {
        throw new AppError("تاريخ نهاية التجربة يجب أن يكون بعد تاريخ البداية", 400);
      }

      center.billingStatus = "trial";
      center.trialStartedAt = trialStartedAt;
      center.trialEndsAt = trialEndsAt;
    } else {
      center.billingStatus = input.billingStatus;
      center.trialStartedAt = null;
      center.trialEndsAt = null;
    }

    await center.save({ validate: false });

    return this.mapAdminCenter(center);
  }
}

export const authReadFacade = new AuthReadFacade();

