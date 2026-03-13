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

const dateField = (invalidFormatMessage: string, invalidValueMessage: string) =>
  z
    .string()
    .regex(ISO_DATE_REGEX, invalidFormatMessage)
    .refine(isValidISODate, invalidValueMessage)
    .optional();

const validateDateRangeQuery = (
  query: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    startDate?: string;
    endDate?: string;
  },
  ctx: z.RefinementCtx,
) => {
  if (query.date && (query.dateFrom || query.dateTo || query.startDate || query.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["date"],
      message: "لا يمكن استخدام date مع أي مدى زمني في نفس الطلب",
    });
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
};

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
  .superRefine(validateDateRangeQuery);

export class AccountingValidation {
  private static moneySchema = z.coerce
    .number({ message: "المبلغ يجب أن يكون رقمًا" })
    .finite("المبلغ غير صالح")
    .min(0, "المبلغ لا يمكن أن يكون بالسالب");

  public static openShift = z.object({
    body: z.object({
      startingCash: AccountingValidation.moneySchema,
    }),
  });

  public static closeShift = z.object({
    body: z.object({
      actualEndingCash: AccountingValidation.moneySchema,
    }),
  });

  public static listShifts = z.object({
    query: dateRangeQuerySchema.extend({
      status: z.enum(["open", "closed"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  });

  public static createTransaction = z.object({
    body: z.object({
      type: z.enum(["IN", "OUT"], { message: "نوع الحركة غير صالح" }),
      amount: AccountingValidation.moneySchema.refine((value) => value > 0, {
        message: "المبلغ يجب أن يكون أكبر من صفر",
      }),
      category: z.enum(
        [
          "subscription",
          "pos_sales",
          "salaries",
          "maintenance",
          "rent_utilities",
          "owner_draw",
          "other",
        ],
        { message: "فئة الحركة غير صالحة" },
      ),
      description: z.string().trim().max(500).optional(),
      occurredAt: z
        .string()
        .datetime("تاريخ الحركة غير صالح")
        .optional(),
    }),
  });

  public static listTransactions = z.object({
    query: dateRangeQuerySchema.extend({
      type: z.enum(["IN", "OUT"]).optional(),
      category: z
        .enum([
          "subscription",
          "pos_sales",
          "salaries",
          "maintenance",
          "rent_utilities",
          "owner_draw",
          "other",
        ])
        .optional(),
      shiftId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  });

  public static dashboardSummary = z.object({
    query: dateRangeQuerySchema,
  });
}

export type IOpenShiftDTO = z.infer<typeof AccountingValidation.openShift>["body"];
export type ICloseShiftDTO = z.infer<typeof AccountingValidation.closeShift>["body"];
export type IListShiftsQuery = z.infer<
  typeof AccountingValidation.listShifts
>["query"];
export type ICreateTransactionDTO = z.infer<
  typeof AccountingValidation.createTransaction
>["body"];
export type IListTransactionsQuery = z.infer<
  typeof AccountingValidation.listTransactions
>["query"];
export type IDashboardSummaryQuery = z.infer<
  typeof AccountingValidation.dashboardSummary
>["query"];
