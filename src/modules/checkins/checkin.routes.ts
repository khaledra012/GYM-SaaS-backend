import { Router } from "express";
import { protect, validate, RateLimitMiddleware } from "../../shared";
import * as checkinController from "./checkin.controller";
import { CheckinValidation } from "./checkin.schema";

const router = Router();

router.use(protect);

router.post(
  "/",
  RateLimitMiddleware.checkinScannerLimiter,
  validate(CheckinValidation.create),
  checkinController.createCheckin,
);
router.get(
  "/today",
  validate(CheckinValidation.listToday),
  checkinController.getTodayCheckins,
);

export default router;
