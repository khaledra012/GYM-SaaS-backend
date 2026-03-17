import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import Center from "../../modules/auth/auth.model";
import { AuthRequest, JwtPayload } from "../types/request.types";
import { normalizeTimezone } from "../utils/timezone";
import { ensureCenterBillingStatus } from "../../modules/auth/center-billing.util";
import Staff from "../../modules/staff/staff.model";

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

    let currentCenter: Center | null = null;

    if (decoded.type === "staff") {
      if (!decoded.staffId || !decoded.centerId) {
        return next(new AppError("رمز الدخول غير صالح", 401));
      }

      const staff = await Staff.findOne({
        where: {
          id: decoded.staffId,
          centerId: decoded.centerId,
        },
      });

      if (!staff) {
        return next(new AppError("هذا الحساب لم يعد متاحًا", 401));
      }

      if (staff.status !== "active") {
        return next(new AppError("حساب الموظف غير مفعل", 403));
      }

      currentCenter = await Center.findByPk(staff.centerId);
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
      req.actor = {
        id: staff.id,
        type: "staff",
        role: staff.role,
        centerId: currentCenter.id,
        name: staff.name,
        email: staff.email ?? null,
        staffId: staff.id,
      };

      return next();
    }

    const centerId = decoded.id;
    if (!centerId) {
      return next(new AppError("رمز الدخول غير صالح", 401));
    }

    currentCenter = await Center.findByPk(centerId);
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
    req.actor = {
      id: currentCenter.id,
      type: "center",
      role: "owner",
      centerId: currentCenter.id,
      name: currentCenter.name,
      email: currentCenter.email ?? null,
      staffId: null,
    };

    return next();
  },
);

