import { Router } from "express";
import { RateLimitMiddleware, validate } from "../../shared";
import * as platformAdminController from "./platform-admin.controller";
import { protectSuperAdmin } from "./platform-admin.guard";
import { PlatformAdminValidation } from "./platform-admin.schema";

const router = Router();

router.post(
  "/auth/login",
  RateLimitMiddleware.authLimiter,
  validate(PlatformAdminValidation.login),
  platformAdminController.login,
);

router.use(protectSuperAdmin);

router.get("/dashboard/summary", platformAdminController.getDashboardSummary);

router.get(
  "/centers",
  validate(PlatformAdminValidation.listCenters),
  platformAdminController.listCenters,
);

router.patch(
  "/centers/:centerId/billing-status",
  validate(PlatformAdminValidation.updateBillingStatus),
  platformAdminController.updateCenterBillingStatus,
);

router.patch(
  "/centers/:centerId/activate",
  validate(PlatformAdminValidation.centerIdParam),
  platformAdminController.activateCenter,
);

router.patch(
  "/centers/:centerId/deactivate",
  validate(PlatformAdminValidation.centerIdParam),
  platformAdminController.deactivateCenter,
);

export default router;

