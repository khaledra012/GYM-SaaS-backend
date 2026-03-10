import Center from "../modules/auth/auth.model";
import Member from "../modules/member/member.model";
import Plan from "../modules/plans/plan.model";
import Subscription from "../modules/subscriptions/subscription.model";
import SubscriptionEvent from "../modules/subscriptions/subscription-event.model";
import Checkin from "../modules/checkins/checkin.model";
import Shift from "../modules/accounting/shift.model";
import AccountingTransaction from "../modules/accounting/accounting-transaction.model";
import { logger } from "../shared";

export const setupAssociations = () => {
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

  logger.info("Database associations setup completed");
};
