import { Op, Transaction } from "sequelize";
import {
  AppError,
  addDaysToDateOnly,
  dateOnlyToUtcStartOfDay,
  getDateOnlyInTimezone,
  normalizeTimezone,
} from "../../shared";
import { planReadFacade } from "../plans/plan.facade";
import Subscription, {
  SubscriptionAttributes,
  SubscriptionCreationAttributes,
} from "./subscription.model";
import SubscriptionEvent from "./subscription-event.model";

interface ILatestSubscriptionRow {
  id: number;
  memberId: number;
  type: SubscriptionAttributes["type"];
  status: SubscriptionAttributes["status"];
  endDate: Date | string | null;
}

export interface IMemberSubscriptionSnapshot {
  id: number;
  memberId: number;
  type: SubscriptionAttributes["type"];
  status: SubscriptionAttributes["status"];
  endDate: Date | null;
  effectiveStatus: SubscriptionAttributes["status"];
}

export interface ICreateInitialSubscriptionForMemberInput {
  centerId: number;
  memberId: number;
  planId: number;
  startDate: string;
  pricePaidCents: number;
  notes?: string | null;
  centerTimezone?: string;
  transaction: Transaction;
}

export type SessionConsumeDenyReasonCode =
  | "subscription_inactive"
  | "subscription_frozen"
  | "subscription_cancelled"
  | "subscription_expired"
  | "sessions_depleted";

export interface IConsumeSessionForCheckinInput {
  centerId: number;
  subscriptionId: number;
  memberId: number;
  checkinAt: Date;
  transaction: Transaction;
}

export interface IConsumeSessionForCheckinResult {
  ok: boolean;
  status: SubscriptionAttributes["status"];
  remainingSessions: number | null;
  denyReasonCode?: SessionConsumeDenyReasonCode;
  denyReasonMessage?: string;
}

export interface IExpiringSoonSummaryItem {
  id: number;
  type: SubscriptionAttributes["type"];
  status: SubscriptionAttributes["status"];
  remainingValue: number;
  remainingUnit: "days" | "sessions";
  remainingDays: number | null;
  remainingSessions: number | null;
  endDate: Date | string | null;
  member: {
    id: number;
    code: string;
    name: string;
    phone: string;
  } | null;
  plan: {
    id: number;
    name: string;
    type: SubscriptionAttributes["type"];
  } | null;
}

export interface IExpiringSoonSummary {
  expiringSoon: number;
  expiringSoonBreakdown: {
    timeBased: number;
    sessionBased: number;
  };
  expiringSoonItems: IExpiringSoonSummaryItem[];
}

class SubscriptionReadFacade {
  private parseDate(value: Date | string | null): Date | null {
    if (!value) return null;
    const parsedDate = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private getEffectiveStatus(
    subscription: Pick<ILatestSubscriptionRow, "type" | "status" | "endDate">,
  ): SubscriptionAttributes["status"] {
    if (subscription.type !== "time_based") {
      return subscription.status;
    }

    if (subscription.status !== "active") {
      return subscription.status;
    }

    const endDate = this.parseDate(subscription.endDate);
    if (!endDate) {
      return subscription.status;
    }

    return endDate.getTime() < Date.now() ? "expired" : subscription.status;
  }

  private parseDateOnlyToUtcTimestamp(dateOnly: string): number {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  private getRemainingDays(
    endDate: Date | string | null,
    now: Date,
    centerTimezone?: string,
  ): number | null {
    const parsedEndDate = this.parseDate(endDate);
    if (!parsedEndDate) return null;

    const timezone = normalizeTimezone(centerTimezone);
    const todayDateOnly = getDateOnlyInTimezone(now, timezone);
    const endDateOnly = getDateOnlyInTimezone(parsedEndDate, timezone);

    const diffMs =
      this.parseDateOnlyToUtcTimestamp(endDateOnly) -
      this.parseDateOnlyToUtcTimestamp(todayDateOnly);

    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return Math.max(0, diffDays);
  }

  private buildExpiringSoonWhere(
    centerId: number,
    now: Date,
    nextDays: number,
    sessionThreshold: number,
  ) {
    const nextWindow = new Date(now);
    nextWindow.setDate(nextWindow.getDate() + nextDays);

    return {
      centerId,
      status: "active",
      [Op.or]: [
        {
          type: "time_based",
          endDate: { [Op.between]: [now, nextWindow] },
        },
        {
          type: "session_based",
          remainingSessions: {
            [Op.gt]: 0,
            [Op.lte]: sessionThreshold,
          },
        },
      ],
    };
  }

  private mapExpiringSoonItem(
    subscription: Subscription,
    now: Date,
    centerTimezone?: string,
  ): IExpiringSoonSummaryItem {
    const data = subscription.toJSON() as any;
    const status = this.getEffectiveStatus({
      type: data.type,
      status: data.status,
      endDate: data.endDate,
    });

    if (data.type === "time_based") {
      const remainingDays =
        status === "expired"
          ? 0
          : this.getRemainingDays(data.endDate, now, centerTimezone);

      return {
        id: data.id,
        type: data.type,
        status,
        remainingValue: remainingDays ?? 0,
        remainingUnit: "days",
        remainingDays: remainingDays ?? 0,
        remainingSessions: null,
        endDate: data.endDate,
        member: data.member
          ? {
              id: data.member.id,
              code: data.member.code,
              name: data.member.name,
              phone: data.member.phone,
            }
          : null,
        plan: data.plan
          ? {
              id: data.plan.id,
              name: data.plan.name,
              type: data.plan.type,
            }
          : null,
      };
    }

    const remainingSessions =
      typeof data.remainingSessions === "number"
        ? Math.max(0, data.remainingSessions)
        : 0;

    return {
      id: data.id,
      type: data.type,
      status,
      remainingValue: remainingSessions,
      remainingUnit: "sessions",
      // Backward-compatible for UI components that still read remainingDays only.
      remainingDays: remainingSessions,
      remainingSessions,
      endDate: data.endDate,
      member: data.member
        ? {
            id: data.member.id,
            code: data.member.code,
            name: data.member.name,
            phone: data.member.phone,
          }
        : null,
      plan: data.plan
        ? {
            id: data.plan.id,
            name: data.plan.name,
            type: data.plan.type,
          }
        : null,
    };
  }

  public async getLatestByMemberId(
    centerId: number,
    memberId: number,
  ): Promise<IMemberSubscriptionSnapshot | null> {
    const snapshots = await this.getLatestByMemberIds(centerId, [memberId]);
    return snapshots.get(memberId) ?? null;
  }

  public async getLatestByMemberIds(
    centerId: number,
    memberIds: number[],
  ): Promise<Map<number, IMemberSubscriptionSnapshot>> {
    const subscriptionsByMember = new Map<number, IMemberSubscriptionSnapshot>();
    if (memberIds.length === 0) return subscriptionsByMember;

    const rows = (await Subscription.findAll({
      attributes: ["id", "memberId", "type", "status", "endDate"],
      where: {
        centerId,
        memberId: {
          [Op.in]: memberIds,
        },
      },
      order: [
        ["memberId", "ASC"],
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      raw: true,
    })) as ILatestSubscriptionRow[];

    for (const row of rows) {
      if (subscriptionsByMember.has(row.memberId)) continue;

      const endDate = this.parseDate(row.endDate);
      subscriptionsByMember.set(row.memberId, {
        id: row.id,
        memberId: row.memberId,
        type: row.type,
        status: row.status,
        endDate,
        effectiveStatus: this.getEffectiveStatus(row),
      });
    }

    return subscriptionsByMember;
  }

  public async countExpiringSoon(
    centerId: number,
    nextDays = 7,
    sessionThreshold = 2,
  ): Promise<number> {
    const now = new Date();

    return Subscription.count({
      where: this.buildExpiringSoonWhere(
        centerId,
        now,
        nextDays,
        sessionThreshold,
      ),
    });
  }

  public async getExpiringSoonSummary(
    centerId: number,
    centerTimezone?: string,
    nextDays = 7,
    sessionThreshold = 2,
    limit = 20,
  ): Promise<IExpiringSoonSummary> {
    const now = new Date();
    const where = this.buildExpiringSoonWhere(
      centerId,
      now,
      nextDays,
      sessionThreshold,
    );

    const nextWindow = new Date(now);
    nextWindow.setDate(nextWindow.getDate() + nextDays);

    const [expiringSoonCount, timeBasedCount, sessionBasedCount, subscriptions] =
      await Promise.all([
        Subscription.count({ where }),
        Subscription.count({
          where: {
            centerId,
            status: "active",
            type: "time_based",
            endDate: { [Op.between]: [now, nextWindow] },
          },
        }),
        Subscription.count({
          where: {
            centerId,
            status: "active",
            type: "session_based",
            remainingSessions: { [Op.gt]: 0, [Op.lte]: sessionThreshold },
          },
        }),
        Subscription.findAll({
          where,
          include: [
            {
              association: "member",
              attributes: ["id", "code", "name", "phone"],
            },
            {
              association: "plan",
              attributes: ["id", "name", "type"],
            },
          ],
          order: [["createdAt", "DESC"]],
          limit,
        }),
      ]);

    return {
      expiringSoon: expiringSoonCount,
      expiringSoonBreakdown: {
        timeBased: timeBasedCount,
        sessionBased: sessionBasedCount,
      },
      expiringSoonItems: subscriptions.map((subscription) =>
        this.mapExpiringSoonItem(subscription, now, centerTimezone),
      ),
    };
  }
}

class SubscriptionCommandFacade {
  private isTimeBasedEffectivelyExpired(subscription: Subscription): boolean {
    if (subscription.type !== "time_based") return false;
    if (subscription.status !== "active") return false;
    if (!subscription.endDate) return false;

    return subscription.endDate.getTime() < Date.now();
  }

  private async logEvent(
    subscriptionId: number,
    centerId: number,
    eventType: "created" | "expired" | "session_deducted" | "session_used",
    metadata: Record<string, any>,
    transaction: Transaction,
  ) {
    await SubscriptionEvent.create(
      {
        subscriptionId,
        centerId,
        eventType,
        metadata,
      },
      { transaction },
    );
  }

  private isEnumValueError(error: unknown): boolean {
    const errorMessage = String((error as any)?.message ?? "");
    return (
      errorMessage.includes("Incorrect enum value") ||
      errorMessage.includes("Data truncated") ||
      errorMessage.includes("invalid input value for enum")
    );
  }

  private async logSessionDeductedEvent(
    subscriptionId: number,
    centerId: number,
    metadata: Record<string, any>,
    transaction: Transaction,
  ) {
    try {
      await this.logEvent(
        subscriptionId,
        centerId,
        "session_deducted",
        metadata,
        transaction,
      );
    } catch (error) {
      if (!this.isEnumValueError(error)) {
        throw error;
      }

      await this.logEvent(
        subscriptionId,
        centerId,
        "session_used",
        {
          ...metadata,
          eventAlias: "session_deducted",
        },
        transaction,
      );
    }
  }

  private mapInactiveReason(
    status: SubscriptionAttributes["status"],
  ): Pick<
    IConsumeSessionForCheckinResult,
    "denyReasonCode" | "denyReasonMessage"
  > {
    if (status === "frozen") {
      return {
        denyReasonCode: "subscription_frozen",
        denyReasonMessage: "الاشتراك مجمد حاليًا",
      };
    }

    if (status === "cancelled") {
      return {
        denyReasonCode: "subscription_cancelled",
        denyReasonMessage: "الاشتراك ملغي",
      };
    }

    if (status === "expired") {
      return {
        denyReasonCode: "subscription_expired",
        denyReasonMessage: "مدة الاشتراك منتهية",
      };
    }

    return {
      denyReasonCode: "subscription_inactive",
      denyReasonMessage: "الاشتراك غير متاح لتسجيل الدخول",
    };
  }

  public async createInitialSubscriptionForMember(
    input: ICreateInitialSubscriptionForMemberInput,
  ): Promise<Subscription> {
    const plan = await planReadFacade.findByIdForSubscription(
      input.planId,
      input.centerId,
      {
        transaction: input.transaction,
        lock: true,
      },
    );

    if (!plan) {
      throw new AppError("الباقة غير موجودة", 404);
    }

    const existingActive = await Subscription.findOne({
      where: {
        memberId: input.memberId,
        centerId: input.centerId,
        status: "active",
      },
      lock: true,
      transaction: input.transaction,
    });

    if (existingActive) {
      throw new AppError(
        "العضو يمتلك اشتراك فعال بالفعل. لا يمكن تفعيل اشتراك جديد.",
        400,
      );
    }

    const timezone = normalizeTimezone(input.centerTimezone);

    let startDate: Date;
    try {
      startDate = dateOnlyToUtcStartOfDay(input.startDate, timezone);
    } catch {
      throw new AppError("تاريخ البدء غير صالح", 400);
    }

    let endDate: Date | null = null;
    let totalSessions: number | null = null;
    let remainingSessions: number | null = null;

    if (plan.type === "time_based") {
      if (!plan.durationInDays) {
        throw new AppError("بيانات الباقة غير صحيحة (المدة مفقودة)", 400);
      }

      const endDateOnly = addDaysToDateOnly(input.startDate, plan.durationInDays);
      endDate = dateOnlyToUtcStartOfDay(endDateOnly, timezone);
    } else {
      if (!plan.sessionCount) {
        throw new AppError("بيانات الباقة غير صحيحة (عدد الحصص مفقود)", 400);
      }

      totalSessions = plan.sessionCount;
      remainingSessions = plan.sessionCount;
    }

    const safeData: SubscriptionCreationAttributes = {
      memberId: input.memberId,
      planId: input.planId,
      centerId: input.centerId,
      source: "plan",
      type: plan.type,
      status: "active",
      startDate,
      endDate,
      totalSessions,
      remainingSessions,
      pricePaidCents: input.pricePaidCents,
      notes: input.notes ?? null,
      freezeCount: 0,
      totalFreezeMinutes: 0,
      frozenAt: null,
    };

    const subscription = await Subscription.create(safeData, {
      transaction: input.transaction,
    });

    await this.logEvent(
      subscription.id,
      input.centerId,
      "created",
      {
        planId: plan.id,
        type: plan.type,
        pricePaidCents: input.pricePaidCents,
        startDate: input.startDate,
        endDate,
        totalSessions,
      },
      input.transaction,
    );

    return subscription;
  }

  public async consumeOneSessionForCheckin(
    input: IConsumeSessionForCheckinInput,
  ): Promise<IConsumeSessionForCheckinResult> {
    const subscription = await Subscription.findOne({
      where: {
        id: input.subscriptionId,
        centerId: input.centerId,
        memberId: input.memberId,
      },
      lock: true,
      transaction: input.transaction,
    });

    if (!subscription) {
      return {
        ok: false,
        status: "expired",
        remainingSessions: null,
        denyReasonCode: "subscription_inactive",
        denyReasonMessage: "الاشتراك غير موجود أو غير متاح",
      };
    }

    if (this.isTimeBasedEffectivelyExpired(subscription)) {
      subscription.status = "expired";
      subscription.frozenAt = null;
      await subscription.save({ transaction: input.transaction });
      await this.logEvent(
        subscription.id,
        input.centerId,
        "expired",
        {
          reason: "date_elapsed_before_checkin_consume",
        },
        input.transaction,
      );

      return {
        ok: false,
        status: subscription.status,
        remainingSessions: subscription.remainingSessions,
        denyReasonCode: "subscription_expired",
        denyReasonMessage: "مدة الاشتراك منتهية",
      };
    }

    if (subscription.status !== "active") {
      const reason = this.mapInactiveReason(subscription.status);
      return {
        ok: false,
        status: subscription.status,
        remainingSessions: subscription.remainingSessions,
        ...reason,
      };
    }

    if (subscription.type !== "session_based") {
      return {
        ok: false,
        status: subscription.status,
        remainingSessions: subscription.remainingSessions,
        denyReasonCode: "subscription_inactive",
        denyReasonMessage: "هذا الاشتراك غير قائم على الحصص",
      };
    }

    if (
      subscription.remainingSessions === null ||
      subscription.totalSessions === null
    ) {
      return {
        ok: false,
        status: subscription.status,
        remainingSessions: subscription.remainingSessions,
        denyReasonCode: "subscription_inactive",
        denyReasonMessage: "بيانات الاشتراك غير مكتملة",
      };
    }

    if (subscription.remainingSessions <= 0) {
      subscription.remainingSessions = 0;
      subscription.status = "expired";
      await subscription.save({ transaction: input.transaction });
      await this.logEvent(
        subscription.id,
        input.centerId,
        "expired",
        { reason: "sessions_depleted_before_checkin" },
        input.transaction,
      );

      return {
        ok: false,
        status: subscription.status,
        remainingSessions: subscription.remainingSessions,
        denyReasonCode: "sessions_depleted",
        denyReasonMessage: "رصيد الحصص انتهى",
      };
    }

    subscription.remainingSessions -= 1;

    await this.logSessionDeductedEvent(
      subscription.id,
      input.centerId,
      {
        count: 1,
        source: "checkin",
        checkinAt: input.checkinAt,
        remainingAfter: subscription.remainingSessions,
      },
      input.transaction,
    );

    if (subscription.remainingSessions === 0) {
      subscription.status = "expired";
      await this.logEvent(
        subscription.id,
        input.centerId,
        "expired",
        { reason: "sessions_depleted_after_checkin" },
        input.transaction,
      );
    }

    await subscription.save({ transaction: input.transaction });

    return {
      ok: true,
      status: subscription.status,
      remainingSessions: subscription.remainingSessions,
    };
  }
}

export const subscriptionReadFacade = new SubscriptionReadFacade();
export const subscriptionCommandFacade = new SubscriptionCommandFacade();








