import Center from "./auth.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Op } from "sequelize";
import { AppError, Email, logger, normalizeTimezone } from "../../shared";
import { ISignupDTO } from "./auth.schema";

interface IEmailRecipient {
  email: string;
  name: string;
}

interface IQueuedPasswordResetEmailInput {
  centerId: number;
  recipient: IEmailRecipient;
  resetURL: string;
}

class AuthService {
  private queueEmailTask(task: () => Promise<void>) {
    setImmediate(() => {
      void task().catch((error) => {
        logger.error("›‘·  ‰›Ì– „Â„… ≈—”«· «·≈Ì„Ì· ›Ì «·Œ·›Ì…", {
          error: String(error),
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
      } catch (error) {
        logger.error("›‘· ≈—”«· ≈Ì„Ì· «” ⁄«œ… ﬂ·„… «·„—Ê—", {
          centerId: input.centerId,
          error: String(error),
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
          logger.error("›‘· ≈·€«¡  Êﬂ‰ «” ⁄«œ… ﬂ·„… «·„—Ê— »⁄œ  ⁄–— «·≈—”«·", {
            centerId: input.centerId,
            error: String(clearError),
          });
        }
      }
    });
  }

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

    const { password: _, ...centerData } = newCenter.toJSON();
    return centerData;
  }

  async login(email: string, password: string) {
    const center = await Center.findOne({ where: { email } });
    if (!center || !(await bcrypt.compare(password, center.password))) {
      throw new AppError("»Ì«‰«  «·œŒÊ· €Ì— ’ÕÌÕ…", 401);
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

  async forgotPassword(email: string): Promise<IQueuedPasswordResetEmailInput> {
    const center = await Center.findOne({ where: { email } });
    const frontendUrl = process.env.FRONTEND_URL;
    if (!center) throw new AppError("·« ÌÊÃœ „” Œœ„ »Â–« «·»—Ìœ", 404);

    const resetToken = crypto.randomBytes(32).toString("hex");
    center.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    center.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

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

    if (!center) throw new AppError("«· Êﬂ‰ €Ì— ’«·Õ √Ê «‰ ÂÏ", 400);

    center.password = await bcrypt.hash(newPass, 10);
    center.passwordResetToken = null;
    center.passwordResetExpires = null;
    await center.save();
  }
}

export const authService = new AuthService();
