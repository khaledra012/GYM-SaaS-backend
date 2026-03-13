import { Transaction } from "sequelize";
import { debtService } from "./debt.service";

export interface ICreateAutomatedDebtInput {
  centerId: number;
  memberId: number;
  amountCents: number;
  title: string;
  note?: string | null;
  referenceType: string;
  referenceId: number;
  createdBy: number;
  occurredAt?: Date;
  centerTimezone?: string;
  transaction?: Transaction;
}

export interface ISettleOutstandingDebtsByAdjustmentInput {
  centerId: number;
  referenceType: string;
  referenceId: number;
  note: string;
  createdBy: number;
  occurredAt?: Date;
  centerTimezone?: string;
  transaction?: Transaction;
}

class DebtCommandFacade {
  public createAutomatedDebt(input: ICreateAutomatedDebtInput) {
    return debtService.createAutomatedDebt({
      ...input,
      source: "subscription",
    });
  }

  public settleOutstandingDebtsByAdjustment(
    input: ISettleOutstandingDebtsByAdjustmentInput,
  ) {
    return debtService.settleOutstandingDebtsByAdjustment(input);
  }

  public buildAutomatedSubscriptionDebtTitle(context: {
    action: "create" | "renew_time" | "renew_sessions" | "renew_expired";
    subscriptionId: number;
  }) {
    return debtService.buildAutomatedSubscriptionDebtTitle(context);
  }

  public buildAutomatedSubscriptionDebtNote(context: {
    totalPriceCents: number;
    pricePaidCents: number;
  }) {
    return debtService.buildAutomatedSubscriptionDebtNote(context);
  }
}

class DebtReadFacade {
  public getMemberDebtSummary(memberId: number, centerId: number) {
    return debtService.getMemberDebtSummary(memberId, centerId);
  }

  public getCenterDebtSummary(centerId: number) {
    return debtService.getSummary(centerId, {});
  }
}

export const debtCommandFacade = new DebtCommandFacade();
export const debtReadFacade = new DebtReadFacade();
