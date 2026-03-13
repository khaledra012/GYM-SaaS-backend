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

const dateField = (formatMessage: string, valueMessage: string) =>
  z
    .string()
    .regex(ISO_DATE_REGEX, formatMessage)
    .refine(isValidISODate, valueMessage)
    .optional();

const dateRangeQuerySchema = z
  .object({
    date: dateField("صيغة التاريخ يجب أن تكون YYYY-MM-DD", "التاريخ غير صالح"),
    dateFrom: dateField(
      "صيغة تاريخ البداية يجب أن تكون YYYY-MM-DD",
      "تاريخ البداية غير صالح",
    ),
    dateTo: dateField(
      "صيغة تاريخ النهاية يجب أن تكون YYYY-MM-DD",
      "تاريخ النهاية غير صالح",
    ),
    startDate: dateField(
      "صيغة تاريخ البداية يجب أن تكون YYYY-MM-DD",
      "تاريخ البداية غير صالح",
    ),
    endDate: dateField(
      "صيغة تاريخ النهاية يجب أن تكون YYYY-MM-DD",
      "تاريخ النهاية غير صالح",
    ),
  })
  .superRefine((query, ctx) => {
    if (query.date && (query.dateFrom || query.dateTo || query.startDate || query.endDate)) {
      const normalizedFrom = query.dateFrom ?? query.startDate ?? query.date;
      const normalizedTo = query.dateTo ?? query.endDate ?? query.date;

      if (normalizedFrom !== query.date || normalizedTo !== query.date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date"],
          message:
            "عند إرسال date مع مدى زمني، يجب أن تكون كل القيم لنفس اليوم فقط",
        });
      }
    }

    if (query.dateFrom && query.startDate && query.dateFrom !== query.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "لا يمكن إرسال قيمتين مختلفتين لـ dateFrom و startDate",
      });
    }

    if (query.dateTo && query.endDate && query.dateTo !== query.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "لا يمكن إرسال قيمتين مختلفتين لـ dateTo و endDate",
      });
    }

    const effectiveDateFrom = query.dateFrom ?? query.startDate;
    const effectiveDateTo = query.dateTo ?? query.endDate;

    if (effectiveDateFrom && effectiveDateTo && effectiveDateFrom > effectiveDateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية",
      });
    }
  });

const idSchema = z.object({
  id: z.coerce
    .number({ message: "المعرف يجب أن يكون رقمًا" })
    .int("المعرف يجب أن يكون رقمًا صحيحًا")
    .positive("المعرف يجب أن يكون أكبر من صفر"),
});

const memberIdSchema = z.object({
  memberId: z.coerce
    .number({ message: "معرف العضو يجب أن يكون رقمًا" })
    .int("معرف العضو يجب أن يكون رقمًا صحيحًا")
    .positive("معرف العضو يجب أن يكون أكبر من صفر"),
});

export class DebtValidation {
  private static amountCentsSchema = z.coerce
    .number({ message: "المبلغ يجب أن يكون رقمًا" })
    .int("المبلغ يجب أن يكون رقمًا صحيحًا")
    .min(1, "المبلغ يجب أن يكون أكبر من صفر");

  private static amountSchema = z.coerce
    .number({ message: "المبلغ يجب أن يكون رقمًا" })
    .finite("المبلغ غير صالح")
    .min(0.01, "المبلغ يجب أن يكون أكبر من صفر");

  private static moneyToCents(value: number): number {
    return Math.round(value * 100);
  }

  public static createDebt = z.object({
    body: z
      .object({
        memberId: memberIdSchema.shape.memberId,
        title: z
          .string({ message: "عنوان المديونية مطلوب" })
          .trim()
          .min(1, "عنوان المديونية مطلوب")
          .max(191, "عنوان المديونية طويل جدًا"),
        note: z.string().trim().max(2000, "الملاحظة طويلة جدًا").optional(),
        amountCents: DebtValidation.amountCentsSchema.optional(),
        amount: DebtValidation.amountSchema.optional(),
      })
      .superRefine((data, ctx) => {
        if (data.amountCents === undefined && data.amount === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["amountCents"],
            message: "يجب إرسال amountCents أو amount",
          });
          return;
        }

        if (data.amount !== undefined && data.amountCents !== undefined) {
          const normalized = DebtValidation.moneyToCents(data.amount);
          if (Math.abs(normalized - data.amountCents) > 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["amount"],
              message: "قيمة amount لا تطابق amountCents",
            });
          }
        }
      })
      .transform(({ amount, amountCents, ...rest }) => ({
        ...rest,
        amountCents:
          amountCents ?? DebtValidation.moneyToCents((amount as number) || 0),
      })),
  });

  public static listDebts = z.object({
    query: dateRangeQuerySchema.extend({
      memberId: memberIdSchema.shape.memberId.optional(),
      status: z.enum(["unpaid", "partially_paid", "paid"]).optional(),
      outstandingOnly: z.enum(["true", "false"]).optional(),
      search: z.string().trim().max(255, "نص البحث طويل جدًا").optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  });

  public static summary = z.object({
    query: dateRangeQuerySchema.extend({
      memberId: memberIdSchema.shape.memberId.optional(),
    }),
  });

  public static debtId = z.object({
    params: idSchema,
  });

  public static memberDebts = z.object({
    params: memberIdSchema,
    query: dateRangeQuerySchema.extend({
      status: z.enum(["unpaid", "partially_paid", "paid"]).optional(),
      outstandingOnly: z.enum(["true", "false"]).optional(),
      search: z.string().trim().max(255, "نص البحث طويل جدًا").optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  });

  public static memberSummary = z.object({
    params: memberIdSchema,
  });

  public static createPayment = z.object({
    params: idSchema,
    body: z
      .object({
        amountCents: DebtValidation.amountCentsSchema.optional(),
        amount: DebtValidation.amountSchema.optional(),
        type: z.enum(["cash", "adjustment"], {
          message: "نوع السداد غير صالح",
        }),
        note: z.string().trim().max(2000, "الملاحظة طويلة جدًا").optional(),
      })
      .superRefine((data, ctx) => {
        if (data.amountCents === undefined && data.amount === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["amountCents"],
            message: "يجب إرسال amountCents أو amount",
          });
          return;
        }

        if (data.amount !== undefined && data.amountCents !== undefined) {
          const normalized = DebtValidation.moneyToCents(data.amount);
          if (Math.abs(normalized - data.amountCents) > 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["amount"],
              message: "قيمة amount لا تطابق amountCents",
            });
          }
        }
      })
      .transform(({ amount, amountCents, ...rest }) => ({
        ...rest,
        amountCents:
          amountCents ?? DebtValidation.moneyToCents((amount as number) || 0),
      })),
  });
}

export type ICreateDebtDTO = z.infer<typeof DebtValidation.createDebt>["body"];
export type IListDebtsQuery = z.infer<typeof DebtValidation.listDebts>["query"];
export type IDebtsSummaryQuery = z.infer<typeof DebtValidation.summary>["query"];
export type ICreateDebtPaymentDTO = z.infer<
  typeof DebtValidation.createPayment
>["body"];
export type IMemberDebtsQuery = z.infer<
  typeof DebtValidation.memberDebts
>["query"];
