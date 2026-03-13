import { z } from "zod";

const billingStatusEnum = z.enum(["trial", "subscribed", "unsubscribed"], {
  message: "حالة الاشتراك غير صالحة",
});

const optionalFutureDate = (message: string) =>
  z
    .string()
    .datetime("صيغة التاريخ غير صحيحة")
    .refine((value) => new Date(value).getTime() > Date.now(), {
      message,
    })
    .optional();

const durationDaysField = z.coerce
  .number({ message: "مدة التفعيل يجب أن تكون رقمًا" })
  .int("مدة التفعيل يجب أن تكون رقمًا صحيحًا")
  .min(1, "مدة التفعيل يجب أن تكون يومًا واحدًا على الأقل")
  .max(3650, "مدة التفعيل كبيرة جدًا")
  .optional();

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
        trialEndsAt: optionalFutureDate("تاريخ نهاية التجربة يجب أن يكون في المستقبل"),
        subscriptionEndsAt: optionalFutureDate(
          "تاريخ نهاية التفعيل يجب أن يكون في المستقبل",
        ),
        subscriptionDurationDays: durationDaysField,
      })
      .superRefine((body, ctx) => {
        if (body.billingStatus === "trial") {
          if (body.subscriptionEndsAt || body.subscriptionDurationDays !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["subscriptionEndsAt"],
              message: "حالة trial لا تقبل مدة تفعيل مدفوع",
            });
          }

          return;
        }

        if (body.billingStatus === "subscribed") {
          if (body.trialEndsAt) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["trialEndsAt"],
              message: "لا يمكن إرسال trialEndsAt مع حالة subscribed",
            });
          }

          if (body.subscriptionEndsAt && body.subscriptionDurationDays !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["subscriptionEndsAt"],
              message: "اختر مدة بالأيام أو تاريخ نهاية، وليس الاثنين معًا",
            });
          }

          return;
        }

        if (
          body.trialEndsAt ||
          body.subscriptionEndsAt ||
          body.subscriptionDurationDays !== undefined
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["billingStatus"],
            message: "حالة unsubscribed لا تقبل أي تواريخ أو مدة",
          });
        }
      }),
  });

  public static activateCenter = z.object({
    params: PlatformAdminValidation.centerIdParam.shape.params,
    body: z
      .object({
        subscriptionEndsAt: optionalFutureDate(
          "تاريخ نهاية التفعيل يجب أن يكون في المستقبل",
        ),
        subscriptionDurationDays: durationDaysField,
      })
      .superRefine((body, ctx) => {
        if (body.subscriptionEndsAt && body.subscriptionDurationDays !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["subscriptionEndsAt"],
            message: "اختر مدة بالأيام أو تاريخ نهاية، وليس الاثنين معًا",
          });
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

export type IActivateCenterDTO = z.infer<
  typeof PlatformAdminValidation.activateCenter
>["body"];
