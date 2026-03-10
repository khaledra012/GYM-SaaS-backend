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

  return res.status(201).json({
    status: "نجاح",
    message: "تم إنشاء الحساب بنجاح",
    data: center,
  });
});

export const login = catchAsync(async (req: AuthRequest, res: Response) => {
  const { email, password } = (req as any).validated.body as ILoginDTO;

  const result = await authService.login(email, password);

  return res.status(200).json({
    status: "نجاح",
    message: "تم تسجيل الدخول بنجاح",
    data: result,
  });
});

export const forgotPassword = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { email } = (req as any).validated.body as IForgotPasswordDTO;

    await authService.forgotPassword(email);

    return res.status(200).json({
      status: "نجاح",
      message: "تم إرسال رمز استعادة كلمة المرور",
    });
  },
);

export const resetPassword = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { token } = (req as any).validated.params as { token: string };
    const { password } = (req as any).validated.body as IResetPasswordDTO;

    await authService.resetPassword(token, password);

    return res.status(200).json({
      status: "نجاح",
      message: "تم تحديث كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن",
    });
  },
);
