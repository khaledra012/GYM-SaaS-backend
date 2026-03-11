import { z } from "zod";

const billingStatusEnum = z.enum(["trial", "subscribed", "unsubscribed"], {
  message: "حالة الاشتراك غير صالحة",
});

export class PlatformAdminValidation {
  public static login = z.object({
    body: z.object({
      email: z.string().email("البريد الإلكتروني غير صحيح"),
      password: z.string().min(1, "كلمة المرور مطلوبة"),
    }),
  });

  public static listCenters = z.object({
    query: z.object({
      search: z.string().trim().max(255, "نص البحث طويل جدًا").optional(),
      billingStatus: billingStatusEnum.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  });

  public static centerIdParam = z.object({
    params: z.object({
      centerId: z.coerce.number().int().positive("معرف الجيم غير صالح"),
    }),
  });

  public static updateBillingStatus = z.object({
    params: PlatformAdminValidation.centerIdParam.shape.params,
    body: z
      .object({
        billingStatus: billingStatusEnum,
        trialEndsAt: z.string().datetime("تاريخ نهاية التجربة غير صالح").optional(),
      })
      .superRefine((body, ctx) => {
        if (body.billingStatus !== "trial" && body.trialEndsAt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["trialEndsAt"],
            message: "لا يمكن إرسال تاريخ نهاية تجربة إلا عند اختيار حالة trial",
          });
          return;
        }

        if (body.billingStatus === "trial" && body.trialEndsAt) {
          const trialEndsAt = new Date(body.trialEndsAt);
          if (Number.isNaN(trialEndsAt.getTime()) || trialEndsAt.getTime() <= Date.now()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["trialEndsAt"],
              message: "تاريخ نهاية التجربة يجب أن يكون في المستقبل",
            });
          }
        }
      }),
  });
}

export type IPlatformAdminLoginDTO = z.infer<
  typeof PlatformAdminValidation.login
>["body"];

export type IListPlatformCentersQuery = z.infer<
  typeof PlatformAdminValidation.listCenters
>["query"];

export type IUpdateCenterBillingStatusParams = z.infer<
  typeof PlatformAdminValidation.centerIdParam
>["params"];

export type IUpdateCenterBillingStatusDTO = z.infer<
  typeof PlatformAdminValidation.updateBillingStatus
>["body"];

