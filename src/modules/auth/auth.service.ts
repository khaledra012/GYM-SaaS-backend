import Center from "./auth.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Op } from "sequelize";
import { AppError, Email, logger, normalizeTimezone } from "../../shared";
import { ISignupDTO } from "./auth.schema";
import {
  calculateTrialEndsAt,
  ensureCenterBillingStatus,
  getSubscriptionDaysLeft,
  getTrialDaysLeft,
} from "./center-billing.util";

interface IEmailRecipient {
  email: string;
  name: string;
}

interface IQueuedPasswordResetEmailInput {
  centerId: number;
  recipient: IEmailRecipient;
  resetURL: string;
}

interface IErrorMeta {
  name?: unknown;
  code?: unknown;
  response?: unknown;
  command?: unknown;
}

class AuthService {
  private queueEmailTask(task: () => Promise<void>) {
    setImmediate(() => {
      void task().catch((error: unknown) => {
        const meta = (error || {}) as IErrorMeta;
        logger.error("ظپط´ظ„ طھظ†ظپظٹط° ظ…ظ‡ظ…ط© ط¥ط±ط³ط§ظ„ ط§ظ„ط¥ظٹظ…ظٹظ„ ظپظٹ ط§ظ„ط®ظ„ظپظٹط©", {
          error: String(error),
          name: typeof meta.name === "string" ? meta.name : undefined,
          code: typeof meta.code === "string" ? meta.code : undefined,
          response: typeof meta.response === "string" ? meta.response : undefined,
          command: typeof meta.command === "string" ? meta.command : undefined,
        });
      });
    });
  }

  queueWelcomeEmail(recipient: IEmailRecipient) {
    this.queueEmailTask(async () => {
      await new Email(recipient).sendWelcome();
    });
  }

  queuePasswordResetEmail(input: IQueuedPasswordResetEmailInput) {
    this.queueEmailTask(async () => {
      try {
        await new Email(input.recipient, input.resetURL).sendPasswordReset();
      } catch (error: unknown) {
        const meta = (error || {}) as IErrorMeta;
        logger.error("ظپط´ظ„ ط¥ط±ط³ط§ظ„ ط¥ظٹظ…ظٹظ„ ط§ط³طھط¹ط§ط¯ط© ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±", {
          centerId: input.centerId,
          error: String(error),
          name: typeof meta.name === "string" ? meta.name : undefined,
          code: typeof meta.code === "string" ? meta.code : undefined,
          response: typeof meta.response === "string" ? meta.response : undefined,
          command: typeof meta.command === "string" ? meta.command : undefined,
        });

        try {
          await Center.update(
            {
              passwordResetToken: null,
              passwordResetExpires: null,
            },
            {
              where: { id: input.centerId },
            },
          );
        } catch (clearError) {
          logger.error("ظپط´ظ„ ط¥ظ„ط؛ط§ط، طھظˆظƒظ† ط§ط³طھط¹ط§ط¯ط© ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط¨ط¹ط¯ طھط¹ط°ط± ط§ظ„ط¥ط±ط³ط§ظ„", {
            centerId: input.centerId,
            error: String(clearError),
          });
        }
      }
    });
  }

  async signup(data: ISignupDTO) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const trialStartedAt = new Date();

    const safeData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: hashedPassword,
      timezone: normalizeTimezone(data.timezone),
      billingStatus: "trial" as const,
      trialStartedAt,
      trialEndsAt: calculateTrialEndsAt(trialStartedAt),
    };

    const newCenter = await Center.create(safeData);

    const { password: _, ...centerData } = newCenter.toJSON();
    return centerData;
  }

  async login(email: string, password: string) {
    const center = await Center.findOne({ where: { email } });
    if (!center || !(await bcrypt.compare(password, center.password))) {
      throw new AppError("ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¯ط®ظˆظ„ ط؛ظٹط± طµط­ظٹط­ط©", 401);
    }

    await ensureCenterBillingStatus(center);

    if (center.billingStatus === "unsubscribed") {
      throw new AppError(
        "ط§ظ†طھظ‡طھ ظپطھط±ط© ط§ظ„طھط¬ط±ط¨ط©. ظٹط±ط¬ظ‰ ط§ظ„طھظˆط§طµظ„ ظ…ط¹ ط§ظ„ط¥ط¯ط§ط±ط© ظ„طھظپط¹ظٹظ„ ط§ظ„ط§ط´طھط±ط§ظƒ.",
        403,
      );
    }

    const token = jwt.sign(
      { id: center.id, type: "center" },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1d",
      },
    );

    if (center.passwordResetToken) {
      center.passwordResetToken = null;
      center.passwordResetExpires = null;
      await center.save({ validate: false });
    }

    return {
      token,
      actor: {
        id: center.id,
        type: "center" as const,
        role: "owner" as const,
        centerId: center.id,
        name: center.name,
        email: center.email,
        staffId: null,
      },
      center: {
        id: center.id,
        name: center.name,
        timezone: normalizeTimezone(center.timezone),
        billingStatus: center.billingStatus,
        trialEndsAt: center.trialEndsAt,
        trialDaysLeft: getTrialDaysLeft(center),
        subscriptionEndsAt: center.subscriptionEndsAt,
        subscriptionDaysLeft: getSubscriptionDaysLeft(center),
      },
    };
  }

  async forgotPassword(email: string): Promise<IQueuedPasswordResetEmailInput | null> {
    const center = await Center.findOne({ where: { email } });
    const frontendUrl = process.env.FRONTEND_URL;
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (!center) {
      return null;
    }

    center.passwordResetToken = hashedResetToken;
    center.passwordResetExpires = resetTokenExpiresAt;

    await center.save();
    const resetURL = `${frontendUrl}/reset-password/${resetToken}`;

    return {
      centerId: center.id,
      recipient: {
        email: center.email,
        name: center.name,
      },
      resetURL,
    };
  }

  async resetPassword(token: string, newPass: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const center = await Center.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });

    if (!center) throw new AppError("ط§ظ„طھظˆظƒظ† ط؛ظٹط± طµط§ظ„ط­ ط£ظˆ ط§ظ†طھظ‡ظ‰", 400);

    center.password = await bcrypt.hash(newPass, 10);
    center.passwordResetToken = null;
    center.passwordResetExpires = null;
    await center.save();
  }
}

export const authService = new AuthService();

