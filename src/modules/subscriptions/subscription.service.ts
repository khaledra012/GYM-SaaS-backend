import { Transaction, Op } from "sequelize";
import sequelize from "../../config/db.config";
import Subscription, {
  SubscriptionCreationAttributes,
  SubscriptionAttributes,
} from "./subscription.model";
import SubscriptionEvent from "./subscription-event.model";
import { subscriptionReadFacade } from "./subscription.facade";
import { planReadFacade } from "../plans";
import { memberReadFacade } from "../member";
import { accountingFacade } from "../accounting";
import { debtCommandFacade } from "../debts";
import {
  AppError,
  addDaysToDateOnly,
  dateOnlyToUtcStartOfDay,
  getCurrentDateOnlyInTimezone,
  getDateOnlyInTimezone,
  normalizeTimezone,
} from "../../shared";
import {
  ICreateSubscriptionDTO,
  IListSubscriptionsQuery,
  IRenewTimeBasedDTO,
  IRenewSessionBasedDTO,
  IRenewExpiredDTO,
  IUpdateNotesDTO,
  IDeductSessionsDTO,
  IRefundSubscriptionDTO,
} from "./subscription.schema";

class SubscriptionService {
  private async logEvent(
    subscriptionId: number,
    centerId: number,
    eventType: SubscriptionEvent["eventType"],
    metadata: any,
    transaction?: Transaction,
  ) {
    await SubscriptionEvent.create(
      { subscriptionId, centerId, eventType, metadata },
      { transaction },
    );
  }

  private parseDate(value: Date | string | null): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isDateExpiredForActiveTimeBased(
    subscription: {
      type: SubscriptionAttributes["type"];
      status: SubscriptionAttributes["status"];
      endDate: Date | string | null;
    },
    now: Date,
  ): boolean {
    if (subscription.type !== "time_based") return false;
    if (subscription.status !== "active") return false;

    const endDate = this.parseDate(subscription.endDate);
    if (!endDate) return false;

    return endDate.getTime() < now.getTime();
  }

  private getEffectiveStatus(
    subscription: {
      type: SubscriptionAttributes["type"];
      status: SubscriptionAttributes["status"];
      endDate: Date | string | null;
    },
    now: Date,
  ): SubscriptionAttributes["status"] {
    if (this.isDateExpiredForActiveTimeBased(subscription, now)) {
      return "expired";
    }

    return subscription.status;
  }

  private parseDateOnlyToUtcTimestamp(dateOnly: string): number {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  private priceStringToCents(value: string): number {
    const normalized = value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new AppError("سعر الباقة غير صالح", 500);
    }

    const [integerPart, decimalPart = ""] = normalized.split(".");
    return Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));
  }

  private resolveExpectedTotalPriceCents(input: {
    source: SubscriptionAttributes["source"];
    pricePaidCents: number;
    totalPriceCents?: number;
    planPrice?: string;
  }): number {
    if (input.totalPriceCents !== undefined) {
      return input.totalPriceCents;
    }

    if (input.source === "plan") {
      if (!input.planPrice) {
        throw new AppError("لا يمكن تحديد إجمالي قيمة الاشتراك من الباقة", 500);
      }

      return this.priceStringToCents(input.planPrice);
    }

    return input.pricePaidCents;
  }

  private async createDebtForPartialSubscriptionPayment(input: {
    centerId: number;
    memberId: number;
    subscriptionId: number;
    action: "create" | "renew_time" | "renew_sessions" | "renew_expired";
    totalPriceCents: number;
    pricePaidCents: number;
    centerTimezone?: string;
    transaction: Transaction;
  }): Promise<void> {
    const debtAmountCents = input.totalPriceCents - input.pricePaidCents;
    if (debtAmountCents <= 0) {
      return;
    }

    await debtCommandFacade.createAutomatedDebt({
      centerId: input.centerId,
      memberId: input.memberId,
      amountCents: debtAmountCents,
      title: debtCommandFacade.buildAutomatedSubscriptionDebtTitle({
        action: input.action,
        subscriptionId: input.subscriptionId,
      }),
      note: debtCommandFacade.buildAutomatedSubscriptionDebtNote({
        totalPriceCents: input.totalPriceCents,
        pricePaidCents: input.pricePaidCents,
      }),
      referenceType: "subscription",
      referenceId: input.subscriptionId,
      createdBy: input.centerId,
      centerTimezone: input.centerTimezone,
      transaction: input.transaction,
    });
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

  private mapSubscriptionForResponse(
    subscription: Subscription,
    now: Date,
    centerTimezone?: string,
  ) {
    const data = subscription.toJSON() as any;
    const effectiveStatus = this.getEffectiveStatus(data, now);

    data.status = effectiveStatus;
    data.pricePaid = data.pricePaidCents / 100;

    if (data.type === "time_based") {
      const remainingDays = this.getRemainingDays(data.endDate, now, centerTimezone);
      data.remainingDays = effectiveStatus === "expired" ? 0 : remainingDays;
      data.remainingValue = data.remainingDays;
      data.remainingUnit = "days";
      return data;
    }

    const remainingSessions =
      typeof data.remainingSessions === "number"
        ? Math.max(0, data.remainingSessions)
        : 0;

    data.remainingSessions = remainingSessions;
    // Backward-compatible for UI components that still read remainingDays only.
    data.remainingDays = remainingSessions;
    data.remainingValue = remainingSessions;
    data.remainingUnit = "sessions";

    return data;
  }

  private async ensureNotEffectivelyExpiredBeforeWrite(
    subscription: Subscription,
    centerId: number,
    transaction: Transaction,
  ): Promise<void> {
    const now = new Date();

    if (!this.isDateExpiredForActiveTimeBased(subscription, now)) {
      return;
    }

    subscription.status = "expired";
    subscription.frozenAt = null;
    await subscription.save({ transaction });

    await this.logEvent(
      subscription.id,
      centerId,
      "expired",
      {
        reason: "date_elapsed_before_write_action",
      },
      transaction,
    );

    throw new AppError(
      "انتهت مدة الاشتراك. تم تحديث حالته إلى منتهي، أعد تحميل البيانات وحاول مرة أخرى",
      400,
    );
  }

  public async createSubscription(
    data: ICreateSubscriptionDTO,
    centerId: number,
    centerTimezone?: string,
  ): Promise<Subscription> {
    return await sequelize.transaction(async (t) => {
      const member = await memberReadFacade.findByIdInCenter(
        data.memberId,
        centerId,
        { transaction: t, lock: true },
      );
      if (!member) throw new AppError("العضو غير موجود", 404);

      const existingActive = await Subscription.findOne({
        where: { memberId: data.memberId, centerId, status: "active" },
        lock: true,
        transaction: t,
      });

      if (existingActive) {
        throw new AppError(
          "العضو يمتلك اشتراك فعال بالفعل. لا يمكن تفعيل اشتراك جديد.",
          400,
        );
      }

      if (member.status === "inactive") {
        await memberReadFacade.activateIfInactiveInCenter(member.id, centerId, {
          transaction: t,
        });
      }

      const timezone = normalizeTimezone(centerTimezone);

      let startDate: Date;
      try {
        startDate = dateOnlyToUtcStartOfDay(data.startDate, timezone);
      } catch {
        throw new AppError("تاريخ البدء غير صالح", 400);
      }

      let planId: number | null = null;
      let type: SubscriptionAttributes["type"];
      let endDate: Date | null = null;
      let totalSessions: number | null = null;
      let remainingSessions: number | null = null;
      let manualDurationInDays: number | null = null;
      let manualTotalSessions: number | null = null;
      let expectedTotalPriceCents = data.pricePaidCents;

      if (data.source === "plan") {
        const plan = await planReadFacade.findByIdForSubscription(
          data.planId as number,
          centerId,
          { transaction: t, lock: true },
        );
        if (!plan) throw new AppError("الباقة غير موجودة", 404);

        planId = plan.id;
        type = plan.type;
        expectedTotalPriceCents = this.resolveExpectedTotalPriceCents({
          source: data.source,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: data.totalPriceCents,
          planPrice: plan.price,
        });

        if (plan.type === "time_based") {
          if (!plan.durationInDays) {
            throw new AppError("بيانات الباقة غير صحيحة (المدة مفقودة)", 400);
          }

          const endDateOnly = addDaysToDateOnly(
            data.startDate,
            plan.durationInDays,
          );
          endDate = dateOnlyToUtcStartOfDay(endDateOnly, timezone);
        } else {
          if (!plan.sessionCount) {
            throw new AppError("بيانات الباقة غير صحيحة (عدد الحصص مفقود)", 400);
          }

          totalSessions = plan.sessionCount;
          remainingSessions = plan.sessionCount;
        }
      } else {
        type = data.type as SubscriptionAttributes["type"];
        expectedTotalPriceCents = this.resolveExpectedTotalPriceCents({
          source: data.source,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: data.totalPriceCents,
        });

        if (type === "time_based") {
          manualDurationInDays = data.durationInDays as number;
          const endDateOnly = addDaysToDateOnly(
            data.startDate,
            manualDurationInDays,
          );
          endDate = dateOnlyToUtcStartOfDay(endDateOnly, timezone);
        } else {
          manualTotalSessions = data.totalSessions as number;
          totalSessions = manualTotalSessions;
          remainingSessions = manualTotalSessions;
        }
      }

      const safeData: SubscriptionCreationAttributes = {
        memberId: data.memberId,
        planId,
        centerId,
        source: data.source,
        type,
        status: "active",
        startDate,
        endDate,
        totalSessions,
        remainingSessions,
        pricePaidCents: data.pricePaidCents,
        notes: data.notes ?? null,
        freezeCount: 0,
        totalFreezeMinutes: 0,
        frozenAt: null,
      };

      const subscription = await Subscription.create(safeData, {
        transaction: t,
      });

      await accountingFacade.recordAutomatedIncome({
        centerId,
        amount: (data.pricePaidCents / 100).toFixed(2),
        referenceType: "subscription",
        referenceId: subscription.id,
        idempotencyKey: `subscription:create:${subscription.id}`,
        category: "subscription",
        description: "تحصيل قيمة اشتراك جديد",
        createdBy: centerId,
        centerTimezone,
        transaction: t,
      });

      await this.createDebtForPartialSubscriptionPayment({
        centerId,
        memberId: subscription.memberId,
        subscriptionId: subscription.id,
        action: "create",
        totalPriceCents: expectedTotalPriceCents,
        pricePaidCents: data.pricePaidCents,
        centerTimezone,
        transaction: t,
      });

      await this.logEvent(
        subscription.id,
        centerId,
        "created",
        {
          source: data.source,
          planId,
          type,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: expectedTotalPriceCents,
          startDate: data.startDate,
          endDate,
          totalSessions,
          manualDurationInDays,
          manualTotalSessions,
        },
        t,
      );

      return subscription;
    });
  }

  public async getSubscriptions(
    centerId: number,
    query: IListSubscriptionsQuery,
    centerTimezone?: string,
  ) {
    const { status, source, memberId, planId, expiringSoon, page, limit } = query;
    const offset = (page - 1) * limit;
    const now = new Date();

    const whereConditions: any[] = [{ centerId }];

    if (memberId) whereConditions.push({ memberId });
    if (source) whereConditions.push({ source });
    if (planId) whereConditions.push({ planId });

    if (expiringSoon === "true") {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      whereConditions.push({
        status: "active",
        [Op.or]: [
          {
            type: "time_based",
            endDate: { [Op.between]: [now, nextWeek] },
          },
          {
            type: "session_based",
            remainingSessions: { [Op.gt]: 0, [Op.lte]: 2 },
          },
        ],
      });
    } else if (status === "frozen" || status === "cancelled") {
      whereConditions.push({ status });
    } else if (status === "active") {
      whereConditions.push({
        status: "active",
        [Op.or]: [
          { type: "session_based" },
          {
            type: "time_based",
            [Op.or]: [{ endDate: { [Op.gte]: now } }, { endDate: null }],
          },
        ],
      });
    } else if (status === "expired") {
      whereConditions.push({
        [Op.or]: [
          { status: "expired" },
          {
            status: "active",
            type: "time_based",
            endDate: { [Op.lt]: now },
          },
        ],
      });
    }

    const whereClause =
      whereConditions.length === 1
        ? whereConditions[0]
        : { [Op.and]: whereConditions };

    const { rows, count } = await Subscription.findAndCountAll({
      where: whereClause,
      include: [
        {
          association: "member",
          attributes: ["id", "code", "name", "phone"],
        },
        { association: "plan", attributes: ["id", "name", "type"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const mappedRows = rows.map((subscription) =>
      this.mapSubscriptionForResponse(subscription, now, centerTimezone),
    );

    const total = count;

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: mappedRows,
    };
  }

  public async getSubscriptionById(
    id: number,
    centerId: number,
    centerTimezone?: string,
  ) {
    const subscription = await Subscription.findOne({
      where: { id, centerId },
      include: [
        {
          association: "member",
          attributes: ["id", "code", "name", "phone"],
        },
        { association: "plan", attributes: ["id", "name", "type"] },
      ],
    });

    if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

    return this.mapSubscriptionForResponse(subscription, new Date(), centerTimezone);
  }

  public async updateNotes(
    id: number,
    centerId: number,
    data: IUpdateNotesDTO,
  ) {
    const subscription = await Subscription.findOne({
      where: { id, centerId },
    });
    if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

    if (data.notes !== undefined) {
      subscription.notes = data.notes ?? null;
      await subscription.save();
    }

    return subscription;
  }

  public async renewTimeBased(
    id: number,
    centerId: number,
    data: IRenewTimeBasedDTO,
    centerTimezone?: string,
  ) {
    return await sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      await this.ensureNotEffectivelyExpiredBeforeWrite(
        subscription,
        centerId,
        t,
      );

      if (subscription.status !== "active") {
        throw new AppError(
          `لا يمكن تجديد اشتراك حالته ${subscription.status}`,
          400,
        );
      }

      if (subscription.type !== "time_based") {
        throw new AppError("لا يمكن تجديد اشتراك حصص بالمدة", 400);
      }

      const timezone = normalizeTimezone(centerTimezone);
      const oldEndDate = subscription.endDate;
      const baseDateOnly = subscription.endDate
        ? getDateOnlyInTimezone(subscription.endDate, timezone)
        : getCurrentDateOnlyInTimezone(timezone);
      const expectedTotalPriceCents =
        data.totalPriceCents ?? data.pricePaidCents;

      const newEndDateOnly = addDaysToDateOnly(baseDateOnly, data.extraDays);
      const newEndDate = dateOnlyToUtcStartOfDay(newEndDateOnly, timezone);

      subscription.endDate = newEndDate;
      subscription.pricePaidCents += data.pricePaidCents;

      await subscription.save({ transaction: t });

      await accountingFacade.recordAutomatedIncome({
        centerId,
        amount: (data.pricePaidCents / 100).toFixed(2),
        referenceType: "subscription",
        referenceId: subscription.id,
        idempotencyKey: `subscription:renew:time:${subscription.id}:${newEndDate.toISOString()}`,
        category: "subscription",
        description: "تحصيل رسوم تجديد اشتراك زمني",
        createdBy: centerId,
        centerTimezone,
        transaction: t,
      });

      await this.createDebtForPartialSubscriptionPayment({
        centerId,
        memberId: subscription.memberId,
        subscriptionId: subscription.id,
        action: "renew_time",
        totalPriceCents: expectedTotalPriceCents,
        pricePaidCents: data.pricePaidCents,
        centerTimezone,
        transaction: t,
      });

      await this.logEvent(
        subscription.id,
        centerId,
        "renewed",
        {
          extraDays: data.extraDays,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: expectedTotalPriceCents,
          oldEndDate,
          newEndDate,
        },
        t,
      );

      return subscription;
    });
  }

  public async renewSessionBased(
    id: number,
    centerId: number,
    data: IRenewSessionBasedDTO,
    centerTimezone?: string,
  ) {
    return await sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      if (subscription.status !== "active") {
        throw new AppError(
          `لا يمكن تجديد اشتراك حالته ${subscription.status}`,
          400,
        );
      }

      if (subscription.type !== "session_based") {
        throw new AppError("لا يمكن تجديد اشتراك مدة بالحصص", 400);
      }

      const oldRemaining = subscription.remainingSessions || 0;
      const oldTotal = subscription.totalSessions || 0;
      const expectedTotalPriceCents =
        data.totalPriceCents ?? data.pricePaidCents;

      subscription.totalSessions = oldTotal + data.extraSessions;
      subscription.remainingSessions = oldRemaining + data.extraSessions;
      subscription.pricePaidCents += data.pricePaidCents;

      await subscription.save({ transaction: t });

      await accountingFacade.recordAutomatedIncome({
        centerId,
        amount: (data.pricePaidCents / 100).toFixed(2),
        referenceType: "subscription",
        referenceId: subscription.id,
        idempotencyKey: `subscription:renew:sessions:${subscription.id}:${subscription.totalSessions}`,
        category: "subscription",
        description: "تحصيل رسوم تجديد اشتراك حصص",
        createdBy: centerId,
        centerTimezone,
        transaction: t,
      });

      await this.createDebtForPartialSubscriptionPayment({
        centerId,
        memberId: subscription.memberId,
        subscriptionId: subscription.id,
        action: "renew_sessions",
        totalPriceCents: expectedTotalPriceCents,
        pricePaidCents: data.pricePaidCents,
        centerTimezone,
        transaction: t,
      });

      await this.logEvent(
        subscription.id,
        centerId,
        "renewed",
        {
          extraSessions: data.extraSessions,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: expectedTotalPriceCents,
          oldRemaining,
          newRemaining: subscription.remainingSessions,
        },
        t,
      );

      return subscription;
    });
  }

  public async renewExpiredSubscription(
    id: number,
    centerId: number,
    data: IRenewExpiredDTO,
    centerTimezone?: string,
  ) {
    return await sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      const now = new Date();
      if (this.isDateExpiredForActiveTimeBased(subscription, now)) {
        subscription.status = "expired";
        subscription.frozenAt = null;
        await subscription.save({ transaction: t });

        await this.logEvent(
          subscription.id,
          centerId,
          "expired",
          {
            reason: "date_elapsed_before_expired_renewal",
          },
          t,
        );
      }

      if (subscription.status !== "expired") {
        throw new AppError(
          `لا يمكن تجديد اشتراك من هذه الشاشة إلا إذا كان منتهيًا. الحالة الحالية: ${subscription.status}`,
          400,
        );
      }

      const anotherActiveSubscription = await Subscription.findOne({
        where: {
          centerId,
          memberId: subscription.memberId,
          status: "active",
          id: { [Op.ne]: subscription.id },
        },
        lock: true,
        transaction: t,
      });

      if (anotherActiveSubscription) {
        throw new AppError(
          "لا يمكن تجديد هذا الاشتراك لأن العضو لديه اشتراك نشط آخر",
          400,
        );
      }

      const timezone = normalizeTimezone(centerTimezone);
      const startDateOnly =
        data.startDate ?? getCurrentDateOnlyInTimezone(timezone);

      let startDate: Date;
      try {
        startDate = dateOnlyToUtcStartOfDay(startDateOnly, timezone);
      } catch {
        throw new AppError("تاريخ البدء غير صالح", 400);
      }

      const previousSnapshot = {
        source: subscription.source,
        planId: subscription.planId,
        type: subscription.type,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        totalSessions: subscription.totalSessions,
        remainingSessions: subscription.remainingSessions,
        pricePaidCents: subscription.pricePaidCents,
      };

      let source: SubscriptionAttributes["source"];
      let planId: number | null = null;
      let type: SubscriptionAttributes["type"];
      let endDate: Date | null = null;
      let totalSessions: number | null = null;
      let remainingSessions: number | null = null;
      let expectedTotalPriceCents = data.pricePaidCents;

      if (data.mode === "same_plan") {
        if (subscription.source !== "plan" || !subscription.planId) {
          throw new AppError(
            "لا يمكن التجديد بنفس الباقة لأن الاشتراك الحالي غير مرتبط بباقة",
            400,
          );
        }

        const currentPlan = await planReadFacade.findByIdForSubscription(
          subscription.planId,
          centerId,
          { transaction: t, lock: true },
        );

        if (!currentPlan) {
          throw new AppError("الباقة الحالية غير موجودة", 404);
        }

        source = "plan";
        planId = currentPlan.id;
        type = currentPlan.type;
        expectedTotalPriceCents = this.resolveExpectedTotalPriceCents({
          source,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: data.totalPriceCents,
          planPrice: currentPlan.price,
        });

        if (currentPlan.type === "time_based") {
          if (!currentPlan.durationInDays) {
            throw new AppError("بيانات الباقة غير صحيحة (المدة مفقودة)", 400);
          }

          const endDateOnly = addDaysToDateOnly(
            startDateOnly,
            currentPlan.durationInDays,
          );
          endDate = dateOnlyToUtcStartOfDay(endDateOnly, timezone);
        } else {
          if (!currentPlan.sessionCount) {
            throw new AppError("بيانات الباقة غير صحيحة (عدد الحصص مفقود)", 400);
          }

          totalSessions = currentPlan.sessionCount;
          remainingSessions = currentPlan.sessionCount;
        }
      } else if (data.mode === "new_plan") {
        const plan = await planReadFacade.findByIdForSubscription(
          data.planId as number,
          centerId,
          { transaction: t, lock: true },
        );

        if (!plan) {
          throw new AppError("الباقة غير موجودة", 404);
        }

        source = "plan";
        planId = plan.id;
        type = plan.type;
        expectedTotalPriceCents = this.resolveExpectedTotalPriceCents({
          source,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: data.totalPriceCents,
          planPrice: plan.price,
        });

        if (plan.type === "time_based") {
          if (!plan.durationInDays) {
            throw new AppError("بيانات الباقة غير صحيحة (المدة مفقودة)", 400);
          }

          const endDateOnly = addDaysToDateOnly(startDateOnly, plan.durationInDays);
          endDate = dateOnlyToUtcStartOfDay(endDateOnly, timezone);
        } else {
          if (!plan.sessionCount) {
            throw new AppError("بيانات الباقة غير صحيحة (عدد الحصص مفقود)", 400);
          }

          totalSessions = plan.sessionCount;
          remainingSessions = plan.sessionCount;
        }
      } else {
        source = "manual";
        planId = null;
        type = data.type as SubscriptionAttributes["type"];
        expectedTotalPriceCents = this.resolveExpectedTotalPriceCents({
          source,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: data.totalPriceCents,
        });

        if (type === "time_based") {
          const durationInDays = data.durationInDays as number;
          const endDateOnly = addDaysToDateOnly(startDateOnly, durationInDays);
          endDate = dateOnlyToUtcStartOfDay(endDateOnly, timezone);
        } else {
          const manualSessions = data.totalSessions as number;
          totalSessions = manualSessions;
          remainingSessions = manualSessions;
        }
      }

      subscription.source = source;
      subscription.planId = planId;
      subscription.type = type;
      subscription.status = "active";
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.totalSessions = totalSessions;
      subscription.remainingSessions = remainingSessions;
      subscription.pricePaidCents += data.pricePaidCents;
      subscription.frozenAt = null;

      if (data.notes !== undefined) {
        subscription.notes = data.notes ?? null;
      }

      await subscription.save({ transaction: t });

      await memberReadFacade.activateIfInactiveInCenter(
        subscription.memberId,
        centerId,
        { transaction: t },
      );

      await accountingFacade.recordAutomatedIncome({
        centerId,
        amount: (data.pricePaidCents / 100).toFixed(2),
        referenceType: "subscription",
        referenceId: subscription.id,
        idempotencyKey: `subscription:renew:expired:${subscription.id}:${subscription.version}:${startDateOnly}`,
        category: "subscription",
        description: "تحصيل رسوم تجديد اشتراك منتهي",
        createdBy: centerId,
        centerTimezone,
        transaction: t,
      });

      await this.createDebtForPartialSubscriptionPayment({
        centerId,
        memberId: subscription.memberId,
        subscriptionId: subscription.id,
        action: "renew_expired",
        totalPriceCents: expectedTotalPriceCents,
        pricePaidCents: data.pricePaidCents,
        centerTimezone,
        transaction: t,
      });

      await this.logEvent(
        subscription.id,
        centerId,
        "renewed",
        {
          renewalMode: data.mode,
          startDate: startDateOnly,
          pricePaidCents: data.pricePaidCents,
          totalPriceCents: expectedTotalPriceCents,
          previous: previousSnapshot,
          current: {
            source,
            planId,
            type,
            endDate,
            totalSessions,
            remainingSessions,
          },
        },
        t,
      );

      return subscription;
    });
  }
  public async freeze(id: number, centerId: number) {
    return await sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      await this.ensureNotEffectivelyExpiredBeforeWrite(
        subscription,
        centerId,
        t,
      );

      if (subscription.status !== "active") {
        throw new AppError(
          `الاشتراك غير فعال، حالته الحالية: ${subscription.status}`,
          400,
        );
      }

      if (subscription.type !== "time_based") {
        throw new AppError("لا يمكن تجميد اشتراكات الحصص", 400);
      }

      const now = new Date();
      if (subscription.endDate && subscription.endDate < now) {
        throw new AppError("الاشتراك منتهي بالفعل. لا يمكن تجميده.", 400);
      }

      subscription.status = "frozen";
      subscription.frozenAt = now;
      subscription.freezeCount += 1;

      await subscription.save({ transaction: t });

      await this.logEvent(
        subscription.id,
        centerId,
        "frozen",
        { frozenAt: subscription.frozenAt },
        t,
      );

      return subscription;
    });
  }

  public async unfreeze(id: number, centerId: number) {
    return await sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      if (subscription.status !== "frozen") {
        throw new AppError(
          `الاشتراك غير متجمد، حالته الحالية: ${subscription.status}`,
          400,
        );
      }

      if (!subscription.frozenAt) {
        throw new AppError("خطأ في البيانات: تاريخ التجميد غير معروف", 500);
      }

      const now = new Date();
      const freezeDurationMs = now.getTime() - subscription.frozenAt.getTime();
      const freezeDurationMinutes = Math.floor(freezeDurationMs / (1000 * 60));

      const oldEndDate = subscription.endDate;
      if (subscription.endDate) {
        const newEndDate = new Date(
          subscription.endDate.getTime() + freezeDurationMs,
        );
        subscription.endDate = newEndDate;
      }

      subscription.status = "active";
      subscription.totalFreezeMinutes += freezeDurationMinutes;
      const storedFrozenAt = subscription.frozenAt;
      subscription.frozenAt = null;

      await subscription.save({ transaction: t });

      await memberReadFacade.activateIfInactiveInCenter(
        subscription.memberId,
        centerId,
        { transaction: t },
      );

      await this.logEvent(
        subscription.id,
        centerId,
        "unfrozen",
        {
          frozenAt: storedFrozenAt,
          unfrozenAt: now,
          freezeDurationMinutes,
          oldEndDate,
          newEndDate: subscription.endDate,
        },
        t,
      );

      return subscription;
    });
  }

  public async deductSessions(
    id: number,
    centerId: number,
    data: IDeductSessionsDTO,
  ) {
    return await sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      if (subscription.status !== "active") {
        throw new AppError(
          `الاشتراك غير فعال، حالته: ${subscription.status}`,
          400,
        );
      }

      if (subscription.type !== "session_based") {
        throw new AppError("هذا الاشتراك زمني، لا يحتاج لخصم حصص", 400);
      }

      if (subscription.remainingSessions === null) {
        throw new AppError("خطأ في بينات الاشتراك، ليس لديه حصص", 500);
      }

      if (data.count > subscription.remainingSessions) {
        throw new AppError(
          `الحصص المتبقية (${subscription.remainingSessions}) أقل من المطلوب خصمه (${data.count})`,
          400,
        );
      }

      subscription.remainingSessions -= data.count;

      await this.logEvent(
        subscription.id,
        centerId,
        "session_used",
        {
          count: data.count,
          remainingAfter: subscription.remainingSessions,
        },
        t,
      );

      if (subscription.remainingSessions === 0) {
        subscription.status = "expired";
        await this.logEvent(
          subscription.id,
          centerId,
          "expired",
          { reason: "sessions_depleted" },
          t,
        );
      }

      await subscription.save({ transaction: t });

      return subscription;
    });
  }

  public async cancelSubscription(id: number, centerId: number) {
    return await sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      await this.ensureNotEffectivelyExpiredBeforeWrite(
        subscription,
        centerId,
        t,
      );

      if (["expired", "cancelled"].includes(subscription.status)) {
        throw new AppError(
          `الاشتراك بالفعل ${subscription.status === "expired" ? "منتهي" : "ملغي"}`,
          400,
        );
      }

      const previousStatus = subscription.status;
      subscription.status = "cancelled";
      subscription.frozenAt = null;
      await subscription.save({ transaction: t });

      const settledDebtsResult =
        await debtCommandFacade.settleOutstandingDebtsByAdjustment({
        centerId,
        referenceType: "subscription",
        referenceId: subscription.id,
        note: `تصفية مديونية بسبب إلغاء الاشتراك رقم #${subscription.id}`,
        createdBy: centerId,
        transaction: t,
      });

      await this.logEvent(
        subscription.id,
        centerId,
        "cancelled",
        {
          previousStatus,
          settledDebtsCount: settledDebtsResult.count,
        },
        t,
      );

      return subscription;
    });
  }

  public async refundSubscription(
    id: number,
    centerId: number,
    data: IRefundSubscriptionDTO,
    centerTimezone?: string,
  ) {
    return sequelize.transaction(async (t) => {
      const subscription = await Subscription.findOne({
        where: { id, centerId },
        lock: true,
        transaction: t,
      });
      if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

      const refundAmountCents = data.refundAmountCents ?? subscription.pricePaidCents;

      if (subscription.pricePaidCents <= 0) {
        throw new AppError(
          "لا يمكن عمل مرتجع لاشتراك لم يتم تحصيل أي مبلغ له",
          400,
        );
      }

      if (!Number.isInteger(refundAmountCents) || refundAmountCents <= 0) {
        throw new AppError("قيمة المرتجع يجب أن تكون أكبر من صفر", 400);
      }

      if (refundAmountCents > subscription.pricePaidCents) {
        throw new AppError(
          "قيمة المرتجع لا يمكن أن تتجاوز المبلغ المحصل فعليًا",
          400,
        );
      }

      const previousStatus = subscription.status;
      subscription.status = "cancelled";
      subscription.frozenAt = null;
      await subscription.save({ transaction: t });

      const settleResult =
        await debtCommandFacade.settleOutstandingDebtsByAdjustment({
          centerId,
          referenceType: "subscription",
          referenceId: subscription.id,
          note: `تصفية مديونية بسبب مرتجع الاشتراك رقم #${subscription.id}`,
          createdBy: centerId,
          centerTimezone,
          transaction: t,
        });

      const refundDescription =
        data.note?.trim() || `مرتجع اشتراك رقم #${subscription.id}`;

      const refundResult = await accountingFacade.recordSubscriptionRefundExpense({
        centerId,
        subscriptionId: subscription.id,
        amountCents: refundAmountCents,
        description: refundDescription,
        createdBy: centerId,
        centerTimezone,
        transaction: t,
      });

      if (!refundResult.alreadyRecorded) {
        await this.logEvent(
          subscription.id,
          centerId,
          "refunded",
          {
            previousStatus,
            refundAmountCents,
            settledDebtsCount: settleResult.count,
            note: data.note ?? null,
          },
          t,
        );
      }

      return subscription;
    });
  }

  public async getTimeline(id: number, centerId: number) {
    const subscription = await Subscription.findOne({
      where: { id, centerId },
    });
    if (!subscription) throw new AppError("الاشتراك غير موجود", 404);

    const events = await SubscriptionEvent.findAll({
      where: { subscriptionId: id, centerId },
      order: [["createdAt", "DESC"]],
    });

    return events;
  }

  public async autoExpire(centerId: number) {
    const now = new Date();

    const expiredCandidates = await Subscription.findAll({
      attributes: ["id"],
      where: {
        centerId,
        status: "active",
        type: "time_based",
        endDate: { [Op.lt]: now },
      },
    });

    if (expiredCandidates.length === 0) {
      return { count: 0, message: "لا توجد اشتراكات نشطة منتهية" };
    }

    let updatedCount = 0;
    for (const candidate of expiredCandidates) {
      await sequelize.transaction(async (t) => {
        const subscription = await Subscription.findOne({
          where: {
            id: candidate.id,
            centerId,
            status: "active",
            type: "time_based",
            endDate: { [Op.lt]: now },
          },
          lock: true,
          transaction: t,
        });

        if (!subscription) return;

        subscription.status = "expired";
        await subscription.save({ transaction: t });
        await this.logEvent(
          subscription.id,
          centerId,
          "expired",
          { reason: "auto_expired_date" },
          t,
        );

        updatedCount++;
      });
    }

    return {
      count: updatedCount,
      message: `تم إنهاء ${updatedCount} اشتراكًا تلقائيًا بنجاح`,
    };
  }

  public async getStats(centerId: number, centerTimezone?: string) {
    const now = new Date();

    const activeCount = await Subscription.count({
      where: {
        centerId,
        [Op.or]: [
          { status: "active", type: "session_based" },
          {
            status: "active",
            type: "time_based",
            [Op.or]: [{ endDate: { [Op.gte]: now } }, { endDate: null }],
          },
        ],
      },
    });

    const expiringSoonSummary = await subscriptionReadFacade.getExpiringSoonSummary(
      centerId,
      centerTimezone,
    );

    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);

    const expiredRecentlyCount = await Subscription.count({
      where: {
        centerId,
        [Op.or]: [
          {
            status: "expired",
            updatedAt: { [Op.gte]: lastWeek },
          },
          {
            status: "active",
            type: "time_based",
            endDate: { [Op.between]: [lastWeek, now] },
          },
        ],
      },
    });

    return {
      activeSubscriptions: activeCount,
      expiringSoon: expiringSoonSummary.expiringSoon,
      expiredRecently: expiredRecentlyCount,
      expiringSoonBreakdown: expiringSoonSummary.expiringSoonBreakdown,
      expiringSoonItems: expiringSoonSummary.expiringSoonItems,
    };
  }
}

export const subscriptionService = new SubscriptionService();








