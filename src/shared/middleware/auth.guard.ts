import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import Center from "../../modules/auth/auth.model";
import { AuthRequest, JwtPayload } from "../types/request.types";
import { normalizeTimezone } from "../utils/timezone";
import { ensureCenterBillingStatus } from "../../modules/auth/center-billing.util";

export const protect = catchAsync(
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("غير مسموح بالدخول بدون صلاحية", 401));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as JwtPayload;

    const currentCenter = await Center.findByPk(decoded.id);
    if (!currentCenter) {
      return next(new AppError("هذا الحساب لم يعد متاحًا", 401));
    }

    await ensureCenterBillingStatus(currentCenter);

    if (currentCenter.billingStatus === "unsubscribed") {
      return next(
        new AppError(
          "الحساب غير مفعل حاليًا. يرجى سداد الاشتراك لإعادة التفعيل.",
          403,
        ),
      );
    }

    currentCenter.timezone = normalizeTimezone(currentCenter.timezone);
    req.center = currentCenter;
    next();
  },
);

