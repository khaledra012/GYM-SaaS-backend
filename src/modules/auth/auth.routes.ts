import express from "express";
import * as authController from "./auth.controller";
import { validate, RateLimitMiddleware } from "../../shared";
import { AuthValidation } from "./auth.schema";

const router = express.Router();

router.post(
  "/login",
  RateLimitMiddleware.authLimiter,
  validate(AuthValidation.login),
  authController.login,
);

router.post(
  "/signup",
  validate(AuthValidation.signup),
  authController.signup,
);

router.post(
  "/forgot-password",
  RateLimitMiddleware.authLimiter,
  validate(AuthValidation.forgotPassword),
  authController.forgotPassword,
);

router.patch(
  "/reset-password/:token",
  RateLimitMiddleware.authLimiter,
  validate(AuthValidation.resetPassword),
  authController.resetPassword,
);

export default router;
