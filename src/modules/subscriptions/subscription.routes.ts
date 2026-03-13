import { Router } from "express";
import * as subscriptionController from "./subscription.controller";
import { validate, protect } from "../../shared";
import { SubscriptionValidation } from "./subscription.schema";

const router = Router();

router.use(protect);

router.get(
  "/",
  validate(SubscriptionValidation.list),
  subscriptionController.getSubscriptions,
);

router.get("/stats", subscriptionController.getStats);

router.post("/auto-expire", subscriptionController.autoExpire);

router.post(
  "/",
  validate(SubscriptionValidation.create),
  subscriptionController.createSubscription,
);

router.get(
  "/:id",
  validate(SubscriptionValidation.subscriptionId),
  subscriptionController.getSubscriptionById,
);

router.patch(
  "/:id/notes",
  validate(SubscriptionValidation.updateNotes),
  subscriptionController.updateNotes,
);

router.post(
  "/:id/renew/time",
  validate(SubscriptionValidation.renewTimeBased),
  subscriptionController.renewTimeBased,
);

router.post(
  "/:id/renew/sessions",
  validate(SubscriptionValidation.renewSessionBased),
  subscriptionController.renewSessionBased,
);

router.post(
  "/:id/renew/expired",
  validate(SubscriptionValidation.renewExpired),
  subscriptionController.renewExpiredSubscription,
);

router.post(
  "/:id/freeze",
  validate(SubscriptionValidation.subscriptionId),
  subscriptionController.freezeSubscription,
);

router.post(
  "/:id/unfreeze",
  validate(SubscriptionValidation.subscriptionId),
  subscriptionController.unfreezeSubscription,
);

router.post(
  "/:id/deduct-sessions",
  validate(SubscriptionValidation.deductSessions),
  subscriptionController.deductSessions,
);

router.post(
  "/:id/cancel",
  validate(SubscriptionValidation.subscriptionId),
  subscriptionController.cancelSubscription,
);

router.post(
  "/:id/refund",
  validate(SubscriptionValidation.refund),
  subscriptionController.refundSubscription,
);

router.get(
  "/:id/timeline",
  validate(SubscriptionValidation.subscriptionId),
  subscriptionController.getTimeline,
);

export default router;
