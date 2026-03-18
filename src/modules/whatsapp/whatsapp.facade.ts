import { authReadFacade } from "../auth";
import { memberReadFacade } from "../member";
import { subscriptionReadFacade } from "../subscriptions";
import { getDateOnlyInTimezone, logger } from "../../shared";
import { whatsAppService } from "./whatsapp.service";

interface IQueueWelcomeMessageInput {
  centerId: number;
  memberId: number;
}

interface IQueueDebtCreatedMessageInput {
  centerId: number;
  memberId: number;
  amountCents: number;
  outstandingAmountCents: number;
  dedupeKey: string;
}

interface IQueuePaymentReceiptInput {
  centerId: number;
  memberId: number;
  amountCents: number;
  remainingBalanceCents: number;
  dedupeKey: string;
}

interface IQueueDebtFollowUpInput {
  centerId: number;
  memberId: number;
  outstandingAmountCents: number;
  dedupeKey: string;
}

class WhatsAppCommandFacade {
  private centsToMoneyString(amountCents: number): string {
    return (amountCents / 100).toFixed(2);
  }

  public async queueWelcomeMessage(input: IQueueWelcomeMessageInput) {
    const [center, member] = await Promise.all([
      authReadFacade.getCenterForAccess(input.centerId),
      memberReadFacade.findContactByIdInCenter(input.memberId, input.centerId),
    ]);

    if (!center || !member) {
      return { queued: false, reason: "تعذر تجهيز بيانات الرسالة" };
    }

    return whatsAppService.queueTemplateMessage({
      centerId: input.centerId,
      eventType: "member_welcome",
      memberId: member.id,
      phone: member.phone,
      dedupeKey: `member-welcome:${member.id}`,
      variables: {
        name: member.name,
        gym_name: center.name,
      },
      metadata: {
        source: "member_created",
      },
    });
  }

  public async queueDebtCreatedMessage(input: IQueueDebtCreatedMessageInput) {
    const [center, member] = await Promise.all([
      authReadFacade.getCenterForAccess(input.centerId),
      memberReadFacade.findContactByIdInCenter(input.memberId, input.centerId),
    ]);

    if (!center || !member) {
      return { queued: false, reason: "تعذر تجهيز بيانات رسالة المديونية" };
    }

    return whatsAppService.queueTemplateMessage({
      centerId: input.centerId,
      eventType: "debt_created",
      memberId: member.id,
      phone: member.phone,
      dedupeKey: input.dedupeKey,
      variables: {
        name: member.name,
        amount: this.centsToMoneyString(input.amountCents),
        outstanding_amount: this.centsToMoneyString(input.outstandingAmountCents),
        gym_name: center.name,
      },
      metadata: {
        source: "debt_created",
      },
    });
  }

  public async queuePaymentReceipt(input: IQueuePaymentReceiptInput) {
    const [center, member] = await Promise.all([
      authReadFacade.getCenterForAccess(input.centerId),
      memberReadFacade.findContactByIdInCenter(input.memberId, input.centerId),
    ]);

    if (!center || !member) {
      return { queued: false, reason: "تعذر تجهيز بيانات إيصال الدفع" };
    }

    return whatsAppService.queueTemplateMessage({
      centerId: input.centerId,
      eventType: "payment_receipt",
      memberId: member.id,
      phone: member.phone,
      dedupeKey: input.dedupeKey,
      variables: {
        name: member.name,
        amount: this.centsToMoneyString(input.amountCents),
        remaining_balance: this.centsToMoneyString(input.remainingBalanceCents),
        gym_name: center.name,
      },
      metadata: {
        source: "payment_receipt",
      },
    });
  }

  public async queueDebtFollowUp(input: IQueueDebtFollowUpInput) {
    const [center, member] = await Promise.all([
      authReadFacade.getCenterForAccess(input.centerId),
      memberReadFacade.findContactByIdInCenter(input.memberId, input.centerId),
    ]);

    if (!center || !member) {
      return { queued: false, reason: "تعذر تجهيز بيانات تذكير المديونية" };
    }

    return whatsAppService.queueTemplateMessage({
      centerId: input.centerId,
      eventType: "debt_follow_up",
      memberId: member.id,
      phone: member.phone,
      dedupeKey: input.dedupeKey,
      variables: {
        name: member.name,
        outstanding_amount: this.centsToMoneyString(input.outstandingAmountCents),
        gym_name: center.name,
      },
      metadata: {
        source: "debt_follow_up",
      },
    });
  }

  public async runSubscriptionExpirySweep() {
    const centerIds = await authReadFacade.getAllCenterIds();

    for (const centerId of centerIds) {
      const center = await authReadFacade.getCenterForAccess(centerId);
      if (!center) {
        continue;
      }

      const localDate = getDateOnlyInTimezone(new Date(), center.timezone);
      const summary = await subscriptionReadFacade.getExpiringSoonSummary(
        centerId,
        center.timezone,
        3,
        2,
        200,
      );

      for (const item of summary.expiringSoonItems) {
        if (!item.member?.phone || !item.member?.name) {
          continue;
        }

        try {
          await whatsAppService.queueTemplateMessage({
            centerId,
            eventType: "subscription_expiry",
            memberId: item.member.id,
            phone: item.member.phone,
            dedupeKey: `subscription-expiry:${item.id}:${localDate}`,
            variables: {
              name: item.member.name,
              gym_name: center.name,
              remaining_value: item.remainingValue,
              remaining_unit_label:
                item.remainingUnit === "days" ? "يوم" : "حصة",
            },
            metadata: {
              source: "subscription_expiry_job",
              subscriptionId: item.id,
            },
          });
        } catch (error) {
          logger.error("فشل تجهيز تذكير انتهاء الاشتراك عبر واتساب", {
            centerId,
            subscriptionId: item.id,
            error: String(error),
          });
        }
      }
    }
  }
}

export const whatsAppCommandFacade = new WhatsAppCommandFacade();
