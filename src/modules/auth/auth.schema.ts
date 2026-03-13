import { z } from "zod";
import { isValidTimezone } from "../../shared";

export class AuthValidation {
  public static signup = z.object({
    body: z.object({
      name: z.string().min(3, "الاسم يجب أن يكون 3 حروف على الأقل"),
      email: z.string().email("البريد الإلكتروني غير صحيح"),
      password: z
        .string()
        .min(6, "كلمة المرور يجب أن تكون 6 أرقام/حروف على الأقل"),
      phone: z.string().min(11, "رقم التليفون غير صحيح"),
      timezone: z
        .string()
        .trim()
        .min(1, "المنطقة الزمنية غير صالحة")
        .refine(isValidTimezone, "المنطقة الزمنية غير صالحة")
        .optional(),
    }),
  });

  public static login = z.object({
    body: z.object({
      email: z.string().email("البريد الإلكتروني غير صحيح"),
      password: z.string().min(1, "كلمة المرور مطلوبة"),
    }),
  });

  public static forgotPassword = z.object({
    body: z.object({
      email: z.string().email("البريد الإلكتروني غير صحيح"),
    }),
  });

  public static resetPassword = z.object({
    params: z.object({
      token: z.string().min(1, "التوكن مطلوب"),
    }),
    body: z.object({
      password: z
        .string()
        .min(6, "كلمة المرور الجديدة يجب أن تكون 6 حروف على الأقل"),
    }),
  });
}

// DTO Types
export type ISignupDTO = z.infer<typeof AuthValidation.signup>["body"];
export type ILoginDTO = z.infer<typeof AuthValidation.login>["body"];
export type IForgotPasswordDTO = z.infer<typeof AuthValidation.forgotPassword>["body"];
export type IResetPasswordDTO = z.infer<typeof AuthValidation.resetPassword>["body"];
