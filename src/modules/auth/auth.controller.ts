import { Response } from "express";
import { authService } from "./auth.service";
import { catchAsync, AuthRequest } from "../../shared";
import {
  ISignupDTO,
  ILoginDTO,
  IForgotPasswordDTO,
  IResetPasswordDTO,
} from "./auth.schema";

export const signup = catchAsync(async (req: AuthRequest, res: Response) => {
  const data = (req as any).validated.body as ISignupDTO;

  const center = await authService.signup(data);
  res.once("finish", () => {
    authService.queueWelcomeEmail({ email: center.email, name: center.name });
  });

  return res.status(201).json({
    status: "\u0646\u062c\u0627\u062d",
    message:
      "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062d\u0633\u0627\u0628 \u0628\u0646\u062c\u0627\u062d",
    data: center,
  });
});

export const login = catchAsync(async (req: AuthRequest, res: Response) => {
  const { email, password } = (req as any).validated.body as ILoginDTO;

  const result = await authService.login(email, password);

  return res.status(200).json({
    status: "\u0646\u062c\u0627\u062d",
    message:
      "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u0646\u062c\u0627\u062d",
    data: result,
  });
});

export const forgotPassword = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { email } = (req as any).validated.body as IForgotPasswordDTO;

    const resetEmailTask = await authService.forgotPassword(email);
    if (resetEmailTask) {
      res.once("finish", () => {
        authService.queuePasswordResetEmail(resetEmailTask);
      });
    }

    return res.status(200).json({
      status: "\u0646\u062c\u0627\u062d",
      message:
        "\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 \u0648\u0633\u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0633\u062a\u0639\u0627\u062f\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
    });
  },
);

export const resetPassword = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { token } = (req as any).validated.params as { token: string };
    const { password } = (req as any).validated.body as IResetPasswordDTO;

    await authService.resetPassword(token, password);

    return res.status(200).json({
      status: "\u0646\u062c\u0627\u062d",
      message:
        "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062c\u0627\u062d\u060c \u064a\u0645\u0643\u0646\u0643 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0622\u0646",
    });
  },
);
