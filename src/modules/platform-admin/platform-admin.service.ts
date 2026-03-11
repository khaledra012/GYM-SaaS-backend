import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../../shared";
import {
  authReadFacade,
  IListCentersForAdminInput,
  IUpdateCenterBillingStatusInput,
} from "../auth/auth.facade";
import { IPlatformAdminLoginDTO } from "./platform-admin.schema";

class PlatformAdminService {
  private getJwtSecret(): string {
    if (!process.env.JWT_SECRET) {
      throw new AppError("إعدادات الأمان غير مكتملة على الخادم", 500);
    }

    return process.env.JWT_SECRET;
  }

  private getAdminCredentials() {
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const passwordHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

    if (!email || (!password && !passwordHash)) {
      throw new AppError("حساب المشرف العام غير مُعد على الخادم", 500);
    }

    return {
      email,
      password,
      passwordHash,
    };
  }

  private async isPasswordValid(inputPassword: string): Promise<boolean> {
    const creds = this.getAdminCredentials();

    if (creds.passwordHash) {
      return bcrypt.compare(inputPassword, creds.passwordHash);
    }

    return inputPassword === creds.password;
  }

  async login(data: IPlatformAdminLoginDTO) {
    const creds = this.getAdminCredentials();

    if (data.email.trim().toLowerCase() !== creds.email) {
      throw new AppError("بيانات الدخول غير صحيحة", 401);
    }

    const passwordOk = await this.isPasswordValid(data.password);
    if (!passwordOk) {
      throw new AppError("بيانات الدخول غير صحيحة", 401);
    }

    const tokenExpiresIn = (process.env.SUPER_ADMIN_JWT_EXPIRES_IN ||
      "12h") as jwt.SignOptions["expiresIn"];

    const token = jwt.sign(
      {
        role: "super_admin",
        email: creds.email,
      },
      this.getJwtSecret(),
      {
        expiresIn: tokenExpiresIn,
      },
    );

    return {
      token,
      admin: {
        email: creds.email,
      },
    };
  }

  async getDashboardSummary() {
    await authReadFacade.expireDueTrials();
    return authReadFacade.getCentersBillingSummary();
  }

  async listCenters(input: IListCentersForAdminInput) {
    await authReadFacade.expireDueTrials();
    return authReadFacade.listCentersForAdmin(input);
  }

  async updateCenterBillingStatus(input: IUpdateCenterBillingStatusInput) {
    return authReadFacade.updateCenterBillingStatus(input);
  }

  async activateCenter(centerId: number) {
    return this.updateCenterBillingStatus({
      centerId,
      billingStatus: "subscribed",
    });
  }

  async deactivateCenter(centerId: number) {
    return this.updateCenterBillingStatus({
      centerId,
      billingStatus: "unsubscribed",
    });
  }
}

export const platformAdminService = new PlatformAdminService();

