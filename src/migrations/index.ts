import { IMigration } from "./types";
import {
  downCreateCentersTable,
  upCreateCentersTable,
} from "./20260307_02_create_centers_table";
import {
  downCreateMembersTable,
  upCreateMembersTable,
} from "./20260307_03_create_members_table";
import {
  downCreatePlansTable,
  upCreatePlansTable,
} from "./20260307_04_create_plans_table";
import {
  downCreateSubscriptionsTable,
  upCreateSubscriptionsTable,
} from "./20260307_05_create_subscriptions_table";
import {
  downCreateSubscriptionEventsTable,
  upCreateSubscriptionEventsTable,
} from "./20260307_06_create_subscription_events_table";
import {
  downCreateCheckinsTable,
  upCreateCheckinsTable,
} from "./20260307_07_create_checkins_table";
import {
  downSubscriptionManualSource,
  upSubscriptionManualSource,
} from "./20260307_01_subscriptions_manual_source";
import {
  downDropMembershipEndFromMembers,
  upDropMembershipEndFromMembers,
} from "./20260308_01_drop_membership_end_from_members";
import {
  downCreateAccountingTables,
  upCreateAccountingTables,
} from "./20260308_02_create_accounting_tables";
import {
  downAddCenterBillingTrialFields,
  upAddCenterBillingTrialFields,
} from "./20260311_01_add_center_billing_trial_fields";
import {
  downAddCenterSubscriptionPeriodFields,
  upAddCenterSubscriptionPeriodFields,
} from "./20260311_02_add_center_subscription_period_fields";
import {
  downCreateDebtsTables,
  upCreateDebtsTables,
} from "./20260313_01_create_debts_tables";
import {
  downAddRefundedSubscriptionEvent,
  upAddRefundedSubscriptionEvent,
} from "./20260313_02_add_refunded_subscription_event";
import {
  downCreateStaffUsersAndShiftStaffRefs,
  upCreateStaffUsersAndShiftStaffRefs,
} from "./20260317_01_create_staff_users_and_shift_staff_refs";

export const migrations: IMigration[] = [
  {
    id: "20260307_02_create_centers_table",
    name: "Create centers table",
    up: upCreateCentersTable,
    down: downCreateCentersTable,
  },
  {
    id: "20260307_03_create_members_table",
    name: "Create members table",
    up: upCreateMembersTable,
    down: downCreateMembersTable,
  },
  {
    id: "20260307_04_create_plans_table",
    name: "Create plans table",
    up: upCreatePlansTable,
    down: downCreatePlansTable,
  },
  {
    id: "20260307_05_create_subscriptions_table",
    name: "Create subscriptions table",
    up: upCreateSubscriptionsTable,
    down: downCreateSubscriptionsTable,
  },
  {
    id: "20260307_06_create_subscription_events_table",
    name: "Create subscription_events table",
    up: upCreateSubscriptionEventsTable,
    down: downCreateSubscriptionEventsTable,
  },
  {
    id: "20260307_07_create_checkins_table",
    name: "Create checkins table",
    up: upCreateCheckinsTable,
    down: downCreateCheckinsTable,
  },
  {
    id: "20260307_01_subscriptions_manual_source",
    name: "Add subscriptions.source and allow subscriptions.planId null",
    up: upSubscriptionManualSource,
    down: downSubscriptionManualSource,
  },
  {
    id: "20260308_01_drop_membership_end_from_members",
    name: "Drop members.membershipEnd column",
    up: upDropMembershipEndFromMembers,
    down: downDropMembershipEndFromMembers,
  },
  {
    id: "20260308_02_create_accounting_tables",
    name: "Create shifts and transactions tables",
    up: upCreateAccountingTables,
    down: downCreateAccountingTables,
  },
  {
    id: "20260311_01_add_center_billing_trial_fields",
    name: "Add billing status and trial fields to centers",
    up: upAddCenterBillingTrialFields,
    down: downAddCenterBillingTrialFields,
  },
  {
    id: "20260311_02_add_center_subscription_period_fields",
    name: "Add subscription period fields to centers",
    up: upAddCenterSubscriptionPeriodFields,
    down: downAddCenterSubscriptionPeriodFields,
  },
  {
    id: "20260313_01_create_debts_tables",
    name: "Create debts and debt_payments tables",
    up: upCreateDebtsTables,
    down: downCreateDebtsTables,
  },
  {
    id: "20260313_02_add_refunded_subscription_event",
    name: "Add refunded subscription event type",
    up: upAddRefundedSubscriptionEvent,
    down: downAddRefundedSubscriptionEvent,
  },
  {
    id: "20260317_01_create_staff_users_and_shift_staff_refs",
    name: "Create staff_users table and add shift staff references",
    up: upCreateStaffUsersAndShiftStaffRefs,
    down: downCreateStaffUsersAndShiftStaffRefs,
  },
];
