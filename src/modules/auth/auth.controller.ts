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
    status: "äÌÇÍ",
    message: "Êã ÅäÔÇÁ ÇáÍÓÇÈ ÈäÌÇÍ",
    data: center,
  });
});

export const login = catchAsync(async (req: AuthRequest, res: Response) => {
  const { email, password } = (req as any).validated.body as ILoginDTO;

  const result = await authService.login(email, password);

  return res.status(200).json({
    status: "äÌÇÍ",
    message: "Êã ÊÓÌíá ÇáÏÎæá ÈäÌÇÍ",
    data: result,
  });
});

export const forgotPassword = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { email } = (req as any).validated.body as IForgotPasswordDTO;

    const resetEmailTask = await authService.forgotPassword(email);
    res.once("finish", () => {
      authService.queuePasswordResetEmail(resetEmailTask);
    });

    return res.status(200).json({
      status: "äÌÇÍ",
      message: "Êã ÇÓÊáÇã ÇáØáÈ æÓíÊã ÅÑÓÇá ÑÇÈØ ÇÓÊÚÇÏÉ ßáãÉ ÇáãÑæÑ",
    });
  },
);

export const resetPassword = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { token } = (req as any).validated.params as { token: string };
    const { password } = (req as any).validated.body as IResetPasswordDTO;

    await authService.resetPassword(token, password);

    return res.status(200).json({
      status: "äÌÇÍ",
      message: "Êã ÊÍÏíË ßáãÉ ÇáãÑæÑ ÈäÌÇÍ¡ íãßäß ÊÓÌíá ÇáÏÎæá ÇáÂä",
    });
  },
);
