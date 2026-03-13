import { z } from "zod";

export const CHECKIN_DENY_REASON_VALUES = [
  "member_not_found",
  "member_inactive",
  "no_subscription",
  "subscription_expired",
  "subscription_frozen",
  "subscription_cancelled",
  "sessions_depleted",
  "cooldown_active",
  "concurrency_conflict",
] as const;

export class CheckinValidation {
  private static createBodySchema = z
    .object({
      memberCode: z.string().trim().min(1, "كود العضو مطلوب").optional(),
      barcodeValue: z
        .string()
        .trim()
        .min(1, "قيمة الباركود غير صالحة")
        .optional(),
    })
    .refine((data) => Boolean(data.memberCode || data.barcodeValue), {
      message: "يجب إرسال كود العضو أو قيمة الباركود",
      path: ["memberCode"],
    });

  private static listTodayQuerySchema = z.object({
    status: z.enum(["approved", "denied"]).optional(),
    denyReasonCode: z.enum(CHECKIN_DENY_REASON_VALUES).optional(),
    memberCode: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  public static create = z.object({
    body: CheckinValidation.createBodySchema,
  });

  public static listToday = z.object({
    query: CheckinValidation.listTodayQuerySchema,
  });
}

export type ICreateCheckinDTO = z.infer<typeof CheckinValidation.create>["body"];
export type IListTodayCheckinsQuery = z.infer<
  typeof CheckinValidation.listToday
>["query"];
