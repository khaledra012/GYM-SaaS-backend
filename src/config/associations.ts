import Center from "../modules/auth/auth.model";
import Member from "../modules/member/member.model";
import Plan from "../modules/plans/plan.model";
import Subscription from "../modules/subscriptions/subscription.model";
import SubscriptionEvent from "../modules/subscriptions/subscription-event.model";
import Checkin from "../modules/checkins/checkin.model";
import Shift from "../modules/accounting/shift.model";
import AccountingTransaction from "../modules/accounting/accounting-transaction.model";
import Staff from "../modules/staff/staff.model";
import { initDebtModels } from "../modules/debts/debt.persistence";
import Debt from "../modules/debts/debt.model";
import DebtPayment from "../modules/debts/debt-payment.model";
import { initWhatsAppModels } from "../modules/whatsapp/whatsapp.persistence";
import WhatsAppCampaign from "../modules/whatsapp/whatsapp-campaign.model";
import WhatsAppSession from "../modules/whatsapp/whatsapp-session.model";
import WhatsAppMessage from "../modules/whatsapp/whatsapp-message.model";
import WhatsAppTemplate from "../modules/whatsapp/whatsapp-template.model";
import WhatsAppOptIn from "../modules/whatsapp/whatsapp-opt-in.model";
import WhatsAppDeliveryLog from "../modules/whatsapp/whatsapp-delivery-log.model";
import { logger } from "../shared";

export const setupAssociations = () => {
  initDebtModels();
  initWhatsAppModels();

  // Center -> Members
  Center.hasMany(Member, { foreignKey: "centerId", as: "members" });
  Member.belongsTo(Center, { foreignKey: "centerId", as: "center" });

  // Center -> Plans
  Center.hasMany(Plan, { foreignKey: "centerId", as: "plans" });
  Plan.belongsTo(Center, { foreignKey: "centerId", as: "center" });

  // Center -> Subscriptions
  Center.hasMany(Subscription, { foreignKey: "centerId", as: "subscriptions" });
  Subscription.belongsTo(Center, { foreignKey: "centerId", as: "center" });

  // Member -> Subscriptions
  Member.hasMany(Subscription, { foreignKey: "memberId", as: "subscriptions" });
  Subscription.belongsTo(Member, { foreignKey: "memberId", as: "member" });

  // Plan -> Subscriptions
  Plan.hasMany(Subscription, { foreignKey: "planId", as: "subscriptions" });
  Subscription.belongsTo(Plan, { foreignKey: "planId", as: "plan" });

  // Subscription -> SubscriptionEvents
  Subscription.hasMany(SubscriptionEvent, {
    foreignKey: "subscriptionId",
    as: "events",
  });
  SubscriptionEvent.belongsTo(Subscription, {
    foreignKey: "subscriptionId",
    as: "subscription",
  });

  // Center -> Checkins
  Center.hasMany(Checkin, { foreignKey: "centerId", as: "checkins" });
  Checkin.belongsTo(Center, { foreignKey: "centerId", as: "center" });

  // Member -> Checkins
  Member.hasMany(Checkin, { foreignKey: "memberId", as: "checkins" });
  Checkin.belongsTo(Member, { foreignKey: "memberId", as: "member" });

  // Subscription -> Checkins
  Subscription.hasMany(Checkin, { foreignKey: "subscriptionId", as: "checkins" });
  Checkin.belongsTo(Subscription, {
    foreignKey: "subscriptionId",
    as: "subscription",
  });

  // Center -> Shifts
  Center.hasMany(Shift, { foreignKey: "centerId", as: "shifts" });
  Shift.belongsTo(Center, { foreignKey: "centerId", as: "center" });

  // Center -> Staff Users
  Center.hasMany(Staff, { foreignKey: "centerId", as: "staffUsers" });
  Staff.belongsTo(Center, { foreignKey: "centerId", as: "center" });

  // Staff -> Shifts actor references
  Staff.hasMany(Shift, { foreignKey: "openedByStaffId", as: "openedShifts" });
  Shift.belongsTo(Staff, { foreignKey: "openedByStaffId", as: "openedByStaff" });

  Staff.hasMany(Shift, { foreignKey: "closedByStaffId", as: "closedShifts" });
  Shift.belongsTo(Staff, { foreignKey: "closedByStaffId", as: "closedByStaff" });

  // Shift -> Accounting Transactions
  Shift.hasMany(AccountingTransaction, {
    foreignKey: "shiftId",
    as: "transactions",
  });
  AccountingTransaction.belongsTo(Shift, {
    foreignKey: "shiftId",
    as: "shift",
  });

  // Center -> Accounting Transactions
  Center.hasMany(AccountingTransaction, {
    foreignKey: "centerId",
    as: "accountingTransactions",
  });
  AccountingTransaction.belongsTo(Center, {
    foreignKey: "centerId",
    as: "accountingCenter",
  });

  // Center -> Debts
  Center.hasMany(Debt, { foreignKey: "centerId", as: "debts" });
  Debt.belongsTo(Center, { foreignKey: "centerId", as: "center" });

  // Member -> Debts
  Member.hasMany(Debt, { foreignKey: "memberId", as: "debts" });
  Debt.belongsTo(Member, { foreignKey: "memberId", as: "member" });

  // Debt -> Debt Payments
  Debt.hasMany(DebtPayment, { foreignKey: "debtId", as: "payments" });
  DebtPayment.belongsTo(Debt, { foreignKey: "debtId", as: "debt" });

  // Center -> Debt Payments
  Center.hasMany(DebtPayment, { foreignKey: "centerId", as: "debtPayments" });
  DebtPayment.belongsTo(Center, { foreignKey: "centerId", as: "debtCenter" });

  // Accounting Transaction -> Debt Payments
  AccountingTransaction.hasMany(DebtPayment, {
    foreignKey: "accountingTransactionId",
    as: "debtPayments",
  });
  DebtPayment.belongsTo(AccountingTransaction, {
    foreignKey: "accountingTransactionId",
    as: "accountingTransaction",
  });

  // Center -> WhatsApp Sessions
  Center.hasMany(WhatsAppSession, {
    foreignKey: "centerId",
    as: "whatsappSessions",
  });
  WhatsAppSession.belongsTo(Center, {
    foreignKey: "centerId",
    as: "center",
  });

  // Center -> WhatsApp Templates
  Center.hasMany(WhatsAppTemplate, {
    foreignKey: "centerId",
    as: "whatsappTemplates",
  });
  WhatsAppTemplate.belongsTo(Center, {
    foreignKey: "centerId",
    as: "templateCenter",
  });

  // Center -> WhatsApp Campaigns
  Center.hasMany(WhatsAppCampaign, {
    foreignKey: "centerId",
    as: "whatsappCampaigns",
  });
  WhatsAppCampaign.belongsTo(Center, {
    foreignKey: "centerId",
    as: "campaignCenter",
  });

  // Center -> WhatsApp Messages
  Center.hasMany(WhatsAppMessage, {
    foreignKey: "centerId",
    as: "whatsappMessages",
  });
  WhatsAppMessage.belongsTo(Center, {
    foreignKey: "centerId",
    as: "messageCenter",
  });

  // Member -> WhatsApp Messages
  Member.hasMany(WhatsAppMessage, {
    foreignKey: "memberId",
    as: "whatsappMessages",
  });
  WhatsAppMessage.belongsTo(Member, {
    foreignKey: "memberId",
    as: "member",
  });

  // Campaign -> WhatsApp Messages
  WhatsAppCampaign.hasMany(WhatsAppMessage, {
    foreignKey: "campaignId",
    as: "messages",
  });
  WhatsAppMessage.belongsTo(WhatsAppCampaign, {
    foreignKey: "campaignId",
    as: "campaign",
  });

  // Session -> WhatsApp Messages
  WhatsAppSession.hasMany(WhatsAppMessage, {
    foreignKey: "sessionId",
    as: "messages",
  });
  WhatsAppMessage.belongsTo(WhatsAppSession, {
    foreignKey: "sessionId",
    as: "session",
  });

  // Template -> WhatsApp Messages
  WhatsAppTemplate.hasMany(WhatsAppMessage, {
    foreignKey: "templateId",
    as: "messages",
  });
  WhatsAppMessage.belongsTo(WhatsAppTemplate, {
    foreignKey: "templateId",
    as: "template",
  });

  // Center -> WhatsApp Opt-ins
  Center.hasMany(WhatsAppOptIn, {
    foreignKey: "centerId",
    as: "whatsappOptIns",
  });
  WhatsAppOptIn.belongsTo(Center, {
    foreignKey: "centerId",
    as: "optInCenter",
  });

  // Member -> WhatsApp Opt-ins
  Member.hasMany(WhatsAppOptIn, {
    foreignKey: "memberId",
    as: "whatsappOptIns",
  });
  WhatsAppOptIn.belongsTo(Member, {
    foreignKey: "memberId",
    as: "member",
  });

  // WhatsApp Message -> Delivery logs
  WhatsAppMessage.hasMany(WhatsAppDeliveryLog, {
    foreignKey: "messageId",
    as: "deliveryLogs",
  });
  WhatsAppDeliveryLog.belongsTo(WhatsAppMessage, {
    foreignKey: "messageId",
    as: "message",
  });

  // WhatsApp Session -> Delivery logs
  WhatsAppSession.hasMany(WhatsAppDeliveryLog, {
    foreignKey: "sessionId",
    as: "deliveryLogs",
  });
  WhatsAppDeliveryLog.belongsTo(WhatsAppSession, {
    foreignKey: "sessionId",
    as: "session",
  });

  logger.info("Database associations setup completed");
};
