import { Router } from "express";
import {
  RateLimitMiddleware,
  allowRoles,
  protect,
  validate,
} from "../../shared";
import * as staffController from "./staff.controller";
import { StaffValidation } from "./staff.schema";

const router = Router();

router.post(
  "/auth/login",
  RateLimitMiddleware.authLimiter,
  validate(StaffValidation.login),
  staffController.login,
);

router.use(protect);

router.get("/me", staffController.getCurrentActor);

router.use(allowRoles("owner"));

router.get("/", validate(StaffValidation.listStaff), staffController.listStaff);
router.post(
  "/",
  validate(StaffValidation.createStaff),
  staffController.createStaff,
);
router.patch(
  "/:id",
  validate(StaffValidation.updateStaff),
  staffController.updateStaff,
);
router.patch(
  "/:id/status",
  validate(StaffValidation.updateStaffStatus),
  staffController.updateStaffStatus,
);
router.patch(
  "/:id/password",
  validate(StaffValidation.resetStaffPassword),
  staffController.resetStaffPassword,
);

export default router;

