import { z } from "zod";

const MEMBER_STATUS_VALUES = ["all", "active", "inactive", "rejected"] as const;
const SUBSCRIPTION_STATUS_VALUES = [
  "active",
  "frozen",
  "expired",
  "cancelled",
  "none",
] as const;
const SUBSCRIPTION_TYPE_VALUES = ["time_based", "session_based"] as const;
const LEGACY_STATUS_VALUES = [
  "all",
  "active",
  "inactive",
  "rejected",
  "frozen",
  "expired",
  "cancelled",
  "none",
] as const;

export class MemberValidation {
  private static idParamSchema = z.object({
    id: z.coerce
      .number({ message: "المعرف يجب أن يكون رقماً" })
      .int("المعرف يجب أن يكون رقمًا صحيحًا")
      .positive("المعرف يجب أن يكون أكبر من صفر"),
  });

  private static dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  private static dateErrorMsg = "يجب أن يكون التاريخ بصيغة YYYY-MM-DD";

  public static createMember = z.object({
    body: z.object({
      name: z
        .string({ message: "اسم المشترك مطلوب ويجب أن يكون نصًا" })
        .min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),

      phone: z
        .string({ message: "رقم الهاتف مطلوب" })
        .min(10, "رقم الهاتف غير صالح"),

      email: z.string().email("البريد الإلكتروني غير صالح").optional(),

      gender: z.enum(["male", "female"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      membershipStart: z
        .string()
        .regex(MemberValidation.dateRegex, MemberValidation.dateErrorMsg)
        .optional(),
    }),
  });

  public static updateMember = z.object({
    params: MemberValidation.idParamSchema,
    body: z.object({
      name: z
        .string()
        .min(3, "الاسم يجب أن يكون 3 أحرف على الأقل")
        .optional(),
      phone: z.string().min(10, "رقم الهاتف غير صالح").optional(),
      email: z.string().email("البريد الإلكتروني غير صالح").optional(),
      gender: z.enum(["male", "female"]).optional(),
      status: z.enum(["active", "inactive", "rejected"]).optional(),
      membershipStart: z
        .string()
        .regex(MemberValidation.dateRegex, MemberValidation.dateErrorMsg)
        .optional(),
    }),
  });

  public static getAllMembers = z.object({
    query: z.object({
      search: z.string({ message: "البحث يجب أن يكون نصًا" }).optional(),
      status: z
        .enum(LEGACY_STATUS_VALUES, {
          message: "حالة غير صالحة للفلترة",
        })
        .optional(),
      memberStatus: z
        .enum(MEMBER_STATUS_VALUES, {
          message: "حالة العضو غير صالحة للفلترة",
        })
        .optional(),
      subscriptionStatus: z
        .enum(SUBSCRIPTION_STATUS_VALUES, {
          message: "حالة الاشتراك غير صالحة للفلترة",
        })
        .optional(),
      subscriptionType: z
        .enum(SUBSCRIPTION_TYPE_VALUES, {
          message: "نوع الاشتراك غير صالح للفلترة",
        })
        .optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  });

  public static memberId = z.object({
    params: MemberValidation.idParamSchema,
  });
}

// DTO Types
export type ICreateMemberDTO = z.infer<typeof MemberValidation.createMember>["body"];
export type IUpdateMemberDTO = z.infer<typeof MemberValidation.updateMember>["body"];
export type IGetAllMembersQuery = z.infer<typeof MemberValidation.getAllMembers>["query"];



