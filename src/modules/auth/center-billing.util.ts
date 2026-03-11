import Center from "./auth.model";

export const TRIAL_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

export const calculateTrialEndsAt = (trialStartedAt: Date): Date => {
  return new Date(trialStartedAt.getTime() + TRIAL_DAYS * DAY_MS);
};

export const ensureCenterBillingStatus = async (
  center: Center,
): Promise<Center> => {
  if (center.billingStatus !== "trial") {
    return center;
  }

  if (!center.trialEndsAt) {
    center.billingStatus = "unsubscribed";
    await center.save({ validate: false });
    return center;
  }

  if (center.trialEndsAt.getTime() <= Date.now()) {
    center.billingStatus = "unsubscribed";
    await center.save({ validate: false });
  }

  return center;
};

export const getTrialDaysLeft = (center: Center): number => {
  if (center.billingStatus !== "trial" || !center.trialEndsAt) {
    return 0;
  }

  const remaining = center.trialEndsAt.getTime() - Date.now();
  if (remaining <= 0) {
    return 0;
  }

  return Math.ceil(remaining / DAY_MS);
};

