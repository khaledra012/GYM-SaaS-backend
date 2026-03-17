import { RequestHandler } from "express";
import { AuthRequest, ActorRole } from "../types/request.types";
import AppError from "../utils/AppError";

export const allowRoles =
  (...roles: ActorRole[]): RequestHandler =>
  (req, _res, next) => {
    const authReq = req as AuthRequest;

    if (!authReq.actor) {
      return next(new AppError("غير مسموح بالدخول بدون صلاحية", 401));
    }

    if (!roles.includes(authReq.actor.role)) {
      return next(new AppError("غير مصرح لك بهذا الإجراء", 403));
    }

    return next();
  };
