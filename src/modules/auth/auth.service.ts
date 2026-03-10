import Center from "./auth.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Op } from "sequelize";
import { AppError, Email, logger, normalizeTimezone } from "../../shared";
import { ISignupDTO } from "./auth.schema";

class AuthService {
  async signup(data: ISignupDTO) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const safeData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: hashedPassword,
      timezone: normalizeTimezone(data.timezone),
    };

    const newCenter = await Center.create(safeData);

    try {
      await new Email(newCenter).sendWelcome();
    } catch (err) {
      logger.error("Failed to send welcome email", { error: String(err) });
    }

    const { password: _, ...centerData } = newCenter.toJSON();
    return centerData;
  }

  async login(email: string, password: string) {
    const center = await Center.findOne({ where: { email } });
    if (!center || !(await bcrypt.compare(password, center.password))) {
      throw new AppError("بيانات الدخول غير صحيحة", 401);
    }

    const token = jwt.sign({ id: center.id }, process.env.JWT_SECRET as string, {
      expiresIn: "1d",
    });

    if (center.passwordResetToken) {
      center.passwordResetToken = null;
      center.passwordResetExpires = null;
      await center.save({ validate: false });
    }

    return {
      token,
      center: {
        id: center.id,
        name: center.name,
        timezone: normalizeTimezone(center.timezone),
      },
    };
  }

  async forgotPassword(email: string) {
    const center = await Center.findOne({ where: { email } });
    const frontendUrl = process.env.FRONTEND_URL;
    if (!center) throw new AppError("لا يوجد مستخدم بهذا البريد", 404);

    const resetToken = crypto.randomBytes(32).toString("hex");
    center.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    center.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

    await center.save();
    const resetURL = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      await new Email(center, resetURL).sendPasswordReset();
    } catch {
      center.passwordResetToken = null;
      center.passwordResetExpires = null;
      await center.save();
      throw new AppError("حدث خطأ في إرسال الإيميل، حاول لاحقاً", 500);
    }
  }

  async resetPassword(token: string, newPass: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const center = await Center.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });

    if (!center) throw new AppError("التوكن غير صالح أو انتهى", 400);

    center.password = await bcrypt.hash(newPass, 10);
    center.passwordResetToken = null;
    center.passwordResetExpires = null;
    await center.save();
  }
}

export const authService = new AuthService();
