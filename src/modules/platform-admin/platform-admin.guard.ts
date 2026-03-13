import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError, catchAsync } from "../../shared";

interface ISuperAdminJwtPayload {
  role: "super_admin";
  email: string;
  iat: number;
  exp: number;
}

export const protectSuperAdmin = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("غير مسموح بالدخول بدون صلاحية", 401));
    }

    if (!process.env.JWT_SECRET) {
      return next(new AppError("إعدادات الأمان غير مكتملة على الخادم", 500));
    }

    let decoded: ISuperAdminJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as ISuperAdminJwtPayload;
    } catch {
      return next(new AppError("رمز الدخول غير صالح أو انتهت صلاحيته", 401));
    }

    if (decoded.role !== "super_admin") {
      return next(new AppError("غير مسموح بهذا الإجراء", 403));
    }

    (req as any).superAdmin = {
      email: decoded.email,
    };

    return next();
  },
);

