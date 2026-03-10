import { Op, Transaction } from "sequelize";
import sequelize from "../../config/db.config";
import {
  AppError,
  getCurrentDateOnlyInTimezone,
  getDateOnlyInTimezone,
  normalizeTimezone,
} from "../../shared";
import { memberReadFacade } from "../member/member.facade";
import {
  IMemberSubscriptionSnapshot,
  SessionConsumeDenyReasonCode,
  subscriptionCommandFacade,
  subscriptionReadFacade,
} from "../subscriptions/subscription.facade";
import Checkin, { CheckinDenyReasonCode } from "./checkin.model";
import { ICreateCheckinDTO, IListTodayCheckinsQuery } from "./checkin.schema";

interface ICheckinMember {
  id: number;
  code: string;
  name: string;
  phone: string;
  status: "active" | "inactive" | "rejected";
}

interface ICheckinAttemptResult {
  result: "approved" | "denied";
  message: string;
  denyReasonCode: CheckinDenyReasonCode | null;
  denyReasonMessage: string | null;
  cooldownRemainingMinutes: number | null;
  member: {
    id: number;
    code: string;
    name: string;
    phone: string;
    status: "active" | "inactive" | "rejected";
    barcodeValue: string;
  } | null;
  subscription: {
    id: number;
    type: "time_based" | "session_based";
    status: "active" | "frozen" | "expired" | "cancelled";
    effectiveStatus: "active" | "frozen" | "expired" | "cancelled";
    endDate: Date | null;
    remainingSessions: number | null;
  } | null;
  checkin: {
    id: number;
    status: "approved" | "denied";
    memberCode: string;
    denyReasonCode: CheckinDenyReasonCode | null;
    denyReasonMessage: string | null;
    checkinAt: Date;
    localDate: string;
  };
}

interface IDeniedLogInput {
  centerId: number;
  memberId: number | null;
  subscriptionId: number | null;
  memberCode: string;
  reasonCode: CheckinDenyReasonCode;
  reasonMessage: string;
  checkinAt: Date;
  localDate: string;
  metadata?: Record<string, any>;
}

interface IApprovedLogInput {
  centerId: number;
  memberId: number;
  subscriptionId: number;
  memberCode: string;
  checkinAt: Date;
  localDate: string;
  metadata?: Record<string, any>;
}

interface ISubscriptionPresentation {
  id: number;
  type: "time_based" | "session_based";
  status: "active" | "frozen" | "expired" | "cancelled";
  effectiveStatus: "active" | "frozen" | "expired" | "cancelled";
  endDate: Date | null;
  remainingSessions: number | null;
}

const DEFAULT_COOLDOWN_MINUTES = 60;

class CheckinService {
  private readonly reasonMessages: Record<CheckinDenyReasonCode, string> = {
    member_not_found: "العضو غير موجود في هذا المركز",
    member_inactive: "العضو غير نشط حاليًا",
    no_subscription: "لا يوجد اشتراك لهذا العضو",
    subscription_expired: "مدة الاشتراك منتهية",
    subscription_frozen: "الاشتراك مجمد حاليًا",
    subscription_cancelled: "الاشتراك ملغي",
    sessions_depleted: "رصيد الحصص انتهى",
    cooldown_active: "تم تسجيل دخول ناجح مؤخرًا، يرجى الانتظار",
    concurrency_conflict: "حدث تعارض أثناء تحديث الرصيد، حاول مرة أخرى",
  };

  private resolveMemberCode(data: ICreateCheckinDTO): string {
    const rawCode = data.memberCode ?? data.barcodeValue ?? "";
    const memberCode = rawCode.trim();

    if (!memberCode) {
      throw new AppError("يجب إرسال كود العضو أو قيمة الباركود", 400);
    }

    return memberCode;
  }

  private getCooldownMinutes(): number {
    const configured = Number(process.env.CHECKIN_COOLDOWN_MINUTES ?? DEFAULT_COOLDOWN_MINUTES);

    if (!Number.isFinite(configured) || configured < 1) {
      return DEFAULT_COOLDOWN_MINUTES;
    }

    return configured;
  }

  private toMemberPayload(member: ICheckinMember | null) {
    if (!member) return null;

    return {
      id: member.id,
      code: member.code,
      name: member.name,
      phone: member.phone,
      status: member.status,
      barcodeValue: member.code,
    };
  }

  private toCheckinPayload(checkin: Checkin) {
    return {
      id: checkin.id,
      status: checkin.status,
      memberCode: checkin.memberCode,
      denyReasonCode: checkin.denyReasonCode,
      denyReasonMessage: checkin.denyReasonMessage,
      checkinAt: checkin.checkinAt,
      localDate: checkin.localDate,
    };
  }

  private toSubscriptionPayload(
    subscription: IMemberSubscriptionSnapshot | ISubscriptionPresentation | null,
  ): ISubscriptionPresentation | null {
    if (!subscription) return null;

    if ("remainingSessions" in subscription) {
      return subscription;
    }

    return {
      id: subscription.id,
      type: subscription.type,
      status: subscription.status,
      effectiveStatus: subscription.effectiveStatus,
      endDate: subscription.endDate,
      remainingSessions: null,
    };
  }

  private buildApprovedResult(
    checkin: Checkin,
    member: ICheckinMember,
    subscription: IMemberSubscriptionSnapshot | ISubscriptionPresentation,
    message: string,
  ): ICheckinAttemptResult {
    return {
      result: "approved",
      message,
      denyReasonCode: null,
      denyReasonMessage: null,
      cooldownRemainingMinutes: null,
      member: this.toMemberPayload(member),
      subscription: this.toSubscriptionPayload(subscription),
      checkin: this.toCheckinPayload(checkin),
    };
  }

  private buildDeniedResult(
    checkin: Checkin,
    reasonCode: CheckinDenyReasonCode,
    reasonMessage: string,
    cooldownRemainingMinutes: number | null,
    member: ICheckinMember | null,
    subscription: IMemberSubscriptionSnapshot | ISubscriptionPresentation | null,
  ): ICheckinAttemptResult {
    return {
      result: "denied",
      message: reasonMessage,
      denyReasonCode: reasonCode,
      denyReasonMessage: reasonMessage,
      cooldownRemainingMinutes,
      member: this.toMemberPayload(member),
      subscription: this.toSubscriptionPayload(subscription),
      checkin: this.toCheckinPayload(checkin),
    };
  }

  private mapSubscriptionDenyReason(
    status: IMemberSubscriptionSnapshot["effectiveStatus"],
  ): {
    code: CheckinDenyReasonCode;
    message: string;
  } {
    if (status === "frozen") {
      return {
        code: "subscription_frozen",
        message: this.reasonMessages.subscription_frozen,
      };
    }

    if (status === "cancelled") {
      return {
        code: "subscription_cancelled",
        message: this.reasonMessages.subscription_cancelled,
      };
    }

    if (status === "expired") {
      return {
        code: "subscription_expired",
        message: this.reasonMessages.subscription_expired,
      };
    }

    return {
      code: "subscription_cancelled",
      message: "الاشتراك غير متاح",
    };
  }

  private mapConsumeDenyReason(reasonCode: SessionConsumeDenyReasonCode): {
    code: CheckinDenyReasonCode;
    message: string;
  } {
    if (reasonCode === "sessions_depleted") {
      return {
        code: "sessions_depleted",
        message: this.reasonMessages.sessions_depleted,
      };
    }

    if (reasonCode === "subscription_frozen") {
      return {
        code: "subscription_frozen",
        message: this.reasonMessages.subscription_frozen,
      };
    }

    if (reasonCode === "subscription_cancelled") {
      return {
        code: "subscription_cancelled",
        message: this.reasonMessages.subscription_cancelled,
      };
    }

    if (reasonCode === "subscription_expired") {
      return {
        code: "subscription_expired",
        message: this.reasonMessages.subscription_expired,
      };
    }

    return {
      code: "subscription_cancelled",
      message: "الاشتراك غير متاح حاليًا",
    };
  }

  private async createDeniedLog(
    input: IDeniedLogInput,
    transaction?: Transaction,
  ): Promise<Checkin> {
    return await Checkin.create(
      {
        centerId: input.centerId,
        memberId: input.memberId,
        subscriptionId: input.subscriptionId,
        memberCode: input.memberCode,
        status: "denied",
        denyReasonCode: input.reasonCode,
        denyReasonMessage: input.reasonMessage,
        checkinAt: input.checkinAt,
        localDate: input.localDate,
        metadata: input.metadata ?? {},
      },
      transaction ? { transaction } : undefined,
    );
  }

  private async createApprovedLog(
    input: IApprovedLogInput,
    transaction?: Transaction,
  ): Promise<Checkin> {
    return await Checkin.create(
      {
        centerId: input.centerId,
        memberId: input.memberId,
        subscriptionId: input.subscriptionId,
        memberCode: input.memberCode,
        status: "approved",
        denyReasonCode: null,
        denyReasonMessage: null,
        checkinAt: input.checkinAt,
        localDate: input.localDate,
        metadata: input.metadata ?? {},
      },
      transaction ? { transaction } : undefined,
    );
  }

  private async getCooldownBlockInfo(
    centerId: number,
    memberId: number,
    now: Date,
  ): Promise<{ blocked: boolean; remainingMinutes: number | null }> {
    const lastApprovedCheckin = await Checkin.findOne({
      attributes: ["id", "checkinAt"],
      where: {
        centerId,
        memberId,
        status: "approved",
      },
      order: [
        ["checkinAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    if (!lastApprovedCheckin) {
      return { blocked: false, remainingMinutes: null };
    }

    const cooldownMs = this.getCooldownMinutes() * 60 * 1000;
    const elapsedMs = now.getTime() - lastApprovedCheckin.checkinAt.getTime();

    if (elapsedMs >= cooldownMs) {
      return { blocked: false, remainingMinutes: null };
    }

    const remainingMinutes = Math.ceil((cooldownMs - elapsedMs) / (60 * 1000));
    return { blocked: true, remainingMinutes };
  }

  private async handleSessionBasedCheckin(
    centerId: number,
    memberCode: string,
    member: ICheckinMember,
    subscription: IMemberSubscriptionSnapshot,
    checkinAt: Date,
    localDate: string,
  ): Promise<ICheckinAttemptResult> {
    try {
      return await sequelize.transaction(async (transaction) => {
        const consumeResult = await subscriptionCommandFacade.consumeOneSessionForCheckin({
          centerId,
          memberId: member.id,
          subscriptionId: subscription.id,
          checkinAt,
          transaction,
        });

        if (!consumeResult.ok) {
          const mappedReason = this.mapConsumeDenyReason(
            consumeResult.denyReasonCode ?? "subscription_expired",
          );

          const deniedLog = await this.createDeniedLog(
            {
              centerId,
              memberId: member.id,
              subscriptionId: subscription.id,
              memberCode,
              reasonCode: mappedReason.code,
              reasonMessage: mappedReason.message,
              checkinAt,
              localDate,
              metadata: {
                source: "checkin",
                type: "session_based",
              },
            },
            transaction,
          );

          const subscriptionView: ISubscriptionPresentation = {
            id: subscription.id,
            type: subscription.type,
            status: consumeResult.status,
            effectiveStatus: consumeResult.status,
            endDate: subscription.endDate,
            remainingSessions: consumeResult.remainingSessions,
          };

          return this.buildDeniedResult(
            deniedLog,
            mappedReason.code,
            mappedReason.message,
            null,
            member,
            subscriptionView,
          );
        }

        const approvedLog = await this.createApprovedLog(
          {
            centerId,
            memberId: member.id,
            subscriptionId: subscription.id,
            memberCode,
            checkinAt,
            localDate,
            metadata: {
              source: "checkin",
              type: "session_based",
              remainingSessionsAfter: consumeResult.remainingSessions,
            },
          },
          transaction,
        );

        const subscriptionView: ISubscriptionPresentation = {
          id: subscription.id,
          type: subscription.type,
          status: consumeResult.status,
          effectiveStatus: consumeResult.status,
          endDate: subscription.endDate,
          remainingSessions: consumeResult.remainingSessions,
        };

        return this.buildApprovedResult(
          approvedLog,
          member,
          subscriptionView,
          "تم تسجيل الدخول بنجاح",
        );
      });
    } catch (error: any) {
      if (error?.name !== "SequelizeOptimisticLockError") {
        throw error;
      }

      const deniedLog = await this.createDeniedLog({
        centerId,
        memberId: member.id,
        subscriptionId: subscription.id,
        memberCode,
        reasonCode: "concurrency_conflict",
        reasonMessage: this.reasonMessages.concurrency_conflict,
        checkinAt,
        localDate,
        metadata: {
          source: "checkin",
          type: "session_based",
        },
      });

      return this.buildDeniedResult(
        deniedLog,
        "concurrency_conflict",
        this.reasonMessages.concurrency_conflict,
        null,
        member,
        subscription,
      );
    }
  }

  public async createCheckin(
    data: ICreateCheckinDTO,
    centerId: number,
    centerTimezone?: string,
  ): Promise<ICheckinAttemptResult> {
    const timezone = normalizeTimezone(centerTimezone);
    const memberCode = this.resolveMemberCode(data);
    const checkinAt = new Date();
    const localDate = getDateOnlyInTimezone(checkinAt, timezone);

    const member = (await memberReadFacade.findByCodeInCenter(
      memberCode,
      centerId,
    )) as ICheckinMember | null;

    if (!member) {
      const deniedLog = await this.createDeniedLog({
        centerId,
        memberId: null,
        subscriptionId: null,
        memberCode,
        reasonCode: "member_not_found",
        reasonMessage: this.reasonMessages.member_not_found,
        checkinAt,
        localDate,
        metadata: {
          source: "checkin",
        },
      });

      return this.buildDeniedResult(
        deniedLog,
        "member_not_found",
        this.reasonMessages.member_not_found,
        null,
        null,
        null,
      );
    }

    if (member.status !== "active") {
      const deniedLog = await this.createDeniedLog({
        centerId,
        memberId: member.id,
        subscriptionId: null,
        memberCode,
        reasonCode: "member_inactive",
        reasonMessage: this.reasonMessages.member_inactive,
        checkinAt,
        localDate,
        metadata: {
          source: "checkin",
          memberStatus: member.status,
        },
      });

      return this.buildDeniedResult(
        deniedLog,
        "member_inactive",
        this.reasonMessages.member_inactive,
        null,
        member,
        null,
      );
    }

    const latestSubscription = await subscriptionReadFacade.getLatestByMemberId(
      centerId,
      member.id,
    );

    if (!latestSubscription) {
      const deniedLog = await this.createDeniedLog({
        centerId,
        memberId: member.id,
        subscriptionId: null,
        memberCode,
        reasonCode: "no_subscription",
        reasonMessage: this.reasonMessages.no_subscription,
        checkinAt,
        localDate,
        metadata: {
          source: "checkin",
        },
      });

      return this.buildDeniedResult(
        deniedLog,
        "no_subscription",
        this.reasonMessages.no_subscription,
        null,
        member,
        null,
      );
    }

    if (latestSubscription.effectiveStatus !== "active") {
      const mappedReason = this.mapSubscriptionDenyReason(
        latestSubscription.effectiveStatus,
      );

      const deniedLog = await this.createDeniedLog({
        centerId,
        memberId: member.id,
        subscriptionId: latestSubscription.id,
        memberCode,
        reasonCode: mappedReason.code,
        reasonMessage: mappedReason.message,
        checkinAt,
        localDate,
        metadata: {
          source: "checkin",
          subscriptionStatus: latestSubscription.effectiveStatus,
        },
      });

      return this.buildDeniedResult(
        deniedLog,
        mappedReason.code,
        mappedReason.message,
        null,
        member,
        latestSubscription,
      );
    }

    const cooldownResult = await this.getCooldownBlockInfo(
      centerId,
      member.id,
      checkinAt,
    );

    if (cooldownResult.blocked) {
      const cooldownMessage = `${this.reasonMessages.cooldown_active} (${cooldownResult.remainingMinutes} دقيقة)`;

      const deniedLog = await this.createDeniedLog({
        centerId,
        memberId: member.id,
        subscriptionId: latestSubscription.id,
        memberCode,
        reasonCode: "cooldown_active",
        reasonMessage: cooldownMessage,
        checkinAt,
        localDate,
        metadata: {
          source: "checkin",
          cooldownMinutes: this.getCooldownMinutes(),
          remainingMinutes: cooldownResult.remainingMinutes,
        },
      });

      return this.buildDeniedResult(
        deniedLog,
        "cooldown_active",
        cooldownMessage,
        cooldownResult.remainingMinutes,
        member,
        latestSubscription,
      );
    }

    if (latestSubscription.type === "session_based") {
      return this.handleSessionBasedCheckin(
        centerId,
        memberCode,
        member,
        latestSubscription,
        checkinAt,
        localDate,
      );
    }

    const approvedLog = await this.createApprovedLog({
      centerId,
      memberId: member.id,
      subscriptionId: latestSubscription.id,
      memberCode,
      checkinAt,
      localDate,
      metadata: {
        source: "checkin",
        type: "time_based",
      },
    });

    return this.buildApprovedResult(
      approvedLog,
      member,
      latestSubscription,
      "تم تسجيل الدخول بنجاح",
    );
  }

  public async getTodayCheckins(
    centerId: number,
    query: IListTodayCheckinsQuery,
    centerTimezone?: string,
  ) {
    const timezone = normalizeTimezone(centerTimezone);
    const localDate = getCurrentDateOnlyInTimezone(timezone);

    const { status, denyReasonCode, memberCode, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    const whereConditions: any = {
      centerId,
      localDate,
    };

    if (status) {
      whereConditions.status = status;
    }

    if (denyReasonCode) {
      whereConditions.denyReasonCode = denyReasonCode;
    }

    if (memberCode) {
      whereConditions.memberCode = {
        [Op.like]: `%${memberCode.trim()}%`,
      };
    }

    const { rows, count } = await Checkin.findAndCountAll({
      where: whereConditions,
      include: [
        {
          association: "member",
          attributes: ["id", "code", "name", "phone", "status"],
          required: false,
        },
      ],
      order: [
        ["checkinAt", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
      distinct: true,
    });

    const data = rows.map((row) => {
      const rowData = row.toJSON() as any;
      return {
        id: rowData.id,
        status: rowData.status,
        memberCode: rowData.memberCode,
        barcodeValue: rowData.memberCode,
        denyReasonCode: rowData.denyReasonCode,
        denyReasonMessage: rowData.denyReasonMessage,
        checkinAt: rowData.checkinAt,
        localDate: rowData.localDate,
        member: rowData.member
          ? {
              id: rowData.member.id,
              code: rowData.member.code,
              name: rowData.member.name,
              phone: rowData.member.phone,
              status: rowData.member.status,
            }
          : null,
      };
    });

    return {
      localDate,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data,
    };
  }
}

export const checkinService = new CheckinService();



