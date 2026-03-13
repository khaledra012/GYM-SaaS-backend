import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidISODate = (value: string): boolean => {
  if (!ISO_DATE_REGEX.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export class SubscriptionValidation {
  private static idParamSchema = z.object({
    id: z.coerce
      .number({ message: "المعرف يجب أن يكون رقماً" })
      .int("المعرف يجب أن يكون رقمًا صحيحًا")
      .positive("المعرف يجب أن يكون أكبر من صفر"),
  });

  private static createBodySchema = z
    .object({
      memberId: z.coerce
        .number({ message: "معرف العضو مطلوب" })
        .int("يجب أن يكون رقمًا صحيحًا")
        .positive(),
      source: z.enum(["plan", "manual"]).default("plan"),
      planId: z.coerce.number().int().positive().optional(),
      type: z.enum(["time_based", "session_based"]).optional(),
      durationInDays: z.coerce
        .number()
        .int("عدد الأيام يجب أن يكون رقمًا صحيحًا")
        .min(1, "عدد الأيام يجب أن يكون يومًا واحدًا على الأقل")
        .optional(),
      totalSessions: z.coerce
        .number()
        .int("عدد الحصص يجب أن يكون رقمًا صحيحًا")
        .min(1, "عدد الحصص يجب أن يكون حصة واحدة على الأقل")
        .optional(),
      startDate: z
        .string({ message: "تاريخ البدء مطلوب" })
        .regex(ISO_DATE_REGEX, "يجب أن يكون التاريخ بصيغة YYYY-MM-DD")
        .refine(isValidISODate, "تاريخ البدء غير صالح"),
      pricePaidCents: z.coerce
        .number({ message: "المبلغ المدفوع (بالقروش) مطلوب" })
        .int()
        .min(0, "لا يمكن أن يكون بالسالب"),
      totalPriceCents: z.coerce
        .number({ message: "إجمالي القيمة يجب أن يكون رقمًا" })
        .int("إجمالي القيمة يجب أن يكون رقمًا صحيحًا")
        .min(0, "لا يمكن أن يكون إجمالي القيمة بالسالب")
        .optional(),
      notes: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.totalPriceCents !== undefined &&
        data.totalPriceCents < data.pricePaidCents
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalPriceCents"],
          message: "إجمالي القيمة لا يمكن أن يكون أقل من المبلغ المدفوع",
        });
      }

      if (data.source === "plan") {
        if (data.planId === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["planId"],
            message: "معرف الباقة مطلوب عند إنشاء اشتراك من باقة",
          });
        }

        if (data.type !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["type"],
            message: "لا ترسل نوع الاشتراك يدويًا عند اختيار source=plan",
          });
        }

        if (data.durationInDays !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["durationInDays"],
            message: "لا ترسل عدد الأيام يدويًا عند اختيار source=plan",
          });
        }

        if (data.totalSessions !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["totalSessions"],
            message: "لا ترسل عدد الحصص يدويًا عند اختيار source=plan",
          });
        }

        return;
      }

      if (data.planId !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["planId"],
          message: "لا يمكن إرسال معرف الباقة عند إنشاء اشتراك يدوي",
        });
      }

      if (!data.type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["type"],
          message: "نوع الاشتراك مطلوب عند إنشاء اشتراك يدوي",
        });
        return;
      }

      if (data.type === "time_based") {
        if (data.durationInDays === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["durationInDays"],
            message: "عدد الأيام مطلوب للاشتراك الزمني اليدوي",
          });
        }

        if (data.totalSessions !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["totalSessions"],
            message: "لا يمكن إرسال عدد الحصص مع الاشتراك الزمني",
          });
        }
      }

      if (data.type === "session_based") {
        if (data.totalSessions === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["totalSessions"],
            message: "عدد الحصص مطلوب لاشتراك الحصص اليدوي",
          });
        }

        if (data.durationInDays !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["durationInDays"],
            message: "لا يمكن إرسال عدد الأيام مع اشتراك الحصص",
          });
        }
      }
    });

  private static listQuerySchema = z.object({
    status: z.enum(["active", "frozen", "expired", "cancelled"]).optional(),
    source: z.enum(["plan", "manual"]).optional(),
    memberId: z.coerce.number().int().positive().optional(),
    planId: z.coerce.number().int().positive().optional(),
    expiringSoon: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  });

  private static updateNotesBodySchema = z.object({
    notes: z.string().trim().optional(),
  });

  private static renewTimeBasedBodySchema = z.object({
    extraDays: z.coerce
      .number()
      .int()
      .min(1, "يجب تجديد الاشتراك ليوم واحد على الأقل"),
    pricePaidCents: z.coerce.number().int().min(0, "لا يمكن أن يكون بالسالب"),
    totalPriceCents: z.coerce
      .number()
      .int("إجمالي القيمة يجب أن يكون رقمًا صحيحًا")
      .min(0, "لا يمكن أن يكون إجمالي القيمة بالسالب")
      .optional(),
  }).superRefine((data, ctx) => {
    if (
      data.totalPriceCents !== undefined &&
      data.totalPriceCents < data.pricePaidCents
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalPriceCents"],
        message: "إجمالي القيمة لا يمكن أن يكون أقل من المبلغ المدفوع",
      });
    }
  });

  private static renewSessionBasedBodySchema = z.object({
    extraSessions: z.coerce
      .number()
      .int()
      .min(1, "يجب إضافة حصة واحدة على الأقل"),
    pricePaidCents: z.coerce.number().int().min(0, "لا يمكن أن يكون بالسالب"),
    totalPriceCents: z.coerce
      .number()
      .int("إجمالي القيمة يجب أن يكون رقمًا صحيحًا")
      .min(0, "لا يمكن أن يكون إجمالي القيمة بالسالب")
      .optional(),
  }).superRefine((data, ctx) => {
    if (
      data.totalPriceCents !== undefined &&
      data.totalPriceCents < data.pricePaidCents
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalPriceCents"],
        message: "إجمالي القيمة لا يمكن أن يكون أقل من المبلغ المدفوع",
      });
    }
  });

  private static renewExpiredBodySchema = z
    .object({
      mode: z.enum(["same_plan", "new_plan", "manual"]).default("same_plan"),
      startDate: z
        .string()
        .regex(ISO_DATE_REGEX, "يجب أن يكون التاريخ بصيغة YYYY-MM-DD")
        .refine(isValidISODate, "تاريخ البدء غير صالح")
        .optional(),
      pricePaidCents: z.coerce
        .number()
        .int("المبلغ المدفوع (بالقروش) يجب أن يكون رقمًا صحيحًا")
        .min(0, "لا يمكن أن يكون بالسالب"),
      totalPriceCents: z.coerce
        .number()
        .int("إجمالي القيمة يجب أن يكون رقمًا صحيحًا")
        .min(0, "لا يمكن أن يكون إجمالي القيمة بالسالب")
        .optional(),
      planId: z.coerce.number().int().positive().optional(),
      type: z.enum(["time_based", "session_based"]).optional(),
      durationInDays: z.coerce
        .number()
        .int("عدد الأيام يجب أن يكون رقمًا صحيحًا")
        .min(1, "عدد الأيام يجب أن يكون يومًا واحدًا على الأقل")
        .optional(),
      totalSessions: z.coerce
        .number()
        .int("عدد الحصص يجب أن يكون رقمًا صحيحًا")
        .min(1, "عدد الحصص يجب أن يكون حصة واحدة على الأقل")
        .optional(),
      notes: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.totalPriceCents !== undefined &&
        data.totalPriceCents < data.pricePaidCents
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["totalPriceCents"],
          message: "إجمالي القيمة لا يمكن أن يكون أقل من المبلغ المدفوع",
        });
      }

      if (data.mode === "same_plan") {
        if (data.planId !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["planId"],
            message: "لا ترسل planId عند اختيار التجديد بنفس الباقة الحالية",
          });
        }

        if (data.type !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["type"],
            message: "لا ترسل type عند اختيار التجديد بنفس الباقة الحالية",
          });
        }

        if (data.durationInDays !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["durationInDays"],
            message:
              "لا ترسل durationInDays عند اختيار التجديد بنفس الباقة الحالية",
          });
        }

        if (data.totalSessions !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["totalSessions"],
            message:
              "لا ترسل totalSessions عند اختيار التجديد بنفس الباقة الحالية",
          });
        }
      }

      if (data.mode === "new_plan") {
        if (data.planId === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["planId"],
            message: "planId مطلوب عند اختيار التجديد بباقة جديدة",
          });
        }

        if (data.type !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["type"],
            message: "لا ترسل type عند اختيار التجديد بباقة جديدة",
          });
        }

        if (data.durationInDays !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["durationInDays"],
            message: "لا ترسل durationInDays عند اختيار التجديد بباقة جديدة",
          });
        }

        if (data.totalSessions !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["totalSessions"],
            message: "لا ترسل totalSessions عند اختيار التجديد بباقة جديدة",
          });
        }
      }

      if (data.mode === "manual") {
        if (!data.type) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["type"],
            message: "type مطلوب عند اختيار التجديد اليدوي",
          });
          return;
        }

        if (data.planId !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["planId"],
            message: "لا يمكن إرسال planId عند اختيار التجديد اليدوي",
          });
        }

        if (data.type === "time_based") {
          if (data.durationInDays === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["durationInDays"],
              message: "durationInDays مطلوب للتجديد اليدوي الزمني",
            });
          }

          if (data.totalSessions !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["totalSessions"],
              message: "لا يمكن إرسال totalSessions مع التجديد الزمني اليدوي",
            });
          }
        }

        if (data.type === "session_based") {
          if (data.totalSessions === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["totalSessions"],
              message: "totalSessions مطلوب للتجديد اليدوي بالحصص",
            });
          }

          if (data.durationInDays !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["durationInDays"],
              message: "لا يمكن إرسال durationInDays مع التجديد اليدوي بالحصص",
            });
          }
        }
      }
    });

  private static deductSessionsBodySchema = z.object({
    count: z.coerce
      .number()
      .int()
      .min(1, "يجب خصم حصة واحدة على الأقل")
      .default(1),
  });

  private static refundBodySchema = z
    .object({
      refundAmountCents: z.coerce
        .number()
        .int("قيمة المرتجع يجب أن تكون رقمًا صحيحًا")
        .min(1, "قيمة المرتجع يجب أن تكون أكبر من صفر")
        .optional(),
      note: z.string().trim().max(2000, "الملاحظة طويلة جدًا").optional(),
    });

  public static create = z.object({
    body: SubscriptionValidation.createBodySchema,
  });

  public static list = z.object({
    query: SubscriptionValidation.listQuerySchema,
  });

  public static subscriptionId = z.object({
    params: SubscriptionValidation.idParamSchema,
  });

  public static updateNotes = z.object({
    params: SubscriptionValidation.idParamSchema,
    body: SubscriptionValidation.updateNotesBodySchema,
  });

  public static renewTimeBased = z.object({
    params: SubscriptionValidation.idParamSchema,
    body: SubscriptionValidation.renewTimeBasedBodySchema,
  });

  public static renewSessionBased = z.object({
    params: SubscriptionValidation.idParamSchema,
    body: SubscriptionValidation.renewSessionBasedBodySchema,
  });

  public static renewExpired = z.object({
    params: SubscriptionValidation.idParamSchema,
    body: SubscriptionValidation.renewExpiredBodySchema,
  });

  public static deductSessions = z.object({
    params: SubscriptionValidation.idParamSchema,
    body: SubscriptionValidation.deductSessionsBodySchema,
  });

  public static refund = z.object({
    params: SubscriptionValidation.idParamSchema,
    body: SubscriptionValidation.refundBodySchema,
  });
}

export type ICreateSubscriptionDTO = z.infer<
  typeof SubscriptionValidation.create
>["body"];
export type IListSubscriptionsQuery = z.infer<
  typeof SubscriptionValidation.list
>["query"];
export type IUpdateNotesDTO = z.infer<
  typeof SubscriptionValidation.updateNotes
>["body"];
export type IRenewTimeBasedDTO = z.infer<
  typeof SubscriptionValidation.renewTimeBased
>["body"];
export type IRenewSessionBasedDTO = z.infer<
  typeof SubscriptionValidation.renewSessionBased
>["body"];
export type IRenewExpiredDTO = z.infer<
  typeof SubscriptionValidation.renewExpired
>["body"];
export type IDeductSessionsDTO = z.infer<
  typeof SubscriptionValidation.deductSessions
>["body"];
export type IRefundSubscriptionDTO = z.infer<
  typeof SubscriptionValidation.refund
>["body"];
