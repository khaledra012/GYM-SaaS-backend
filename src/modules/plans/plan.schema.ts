import { z } from "zod";

export class PlanValidation {
  private static idParamSchema = z.object({
    id: z.coerce
      .number({ message: "المعرف يجب أن يكون رقماً" })
      .int("المعرف يجب أن يكون رقمًا صحيحًا")
      .positive("المعرف يجب أن يكون أكبر من صفر"),
  });

  private static createPlanBodySchema = z
    .object({
      name: z
        .string({ message: "اسم الباقة مطلوب" })
        .trim()
        .min(2, "الاسم قصير جدًا")
        .max(120, "الاسم طويل جدًا"),

      description: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v === "" ? undefined : v)),

      price: z.coerce
        .number({ message: "السعر مطلوب ويجب أن يكون رقماً" })
        .min(0, "السعر لا يمكن أن يكون بالسالب"),

      type: z.enum(["time_based", "session_based"], {
        message: "نوع الباقة مطلوب",
      }),

      durationInDays: z.coerce
        .number()
        .int("المدة يجب أن تكون رقمًا صحيحًا")
        .min(1, "المدة يجب أن تكون يومًا أو أكثر")
        .optional(),

      sessionCount: z.coerce
        .number()
        .int("عدد الحصص يجب أن يكون رقمًا صحيحًا")
        .min(1, "عدد الحصص يجب أن يكون 1 على الأقل")
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.durationInDays != null && data.sessionCount != null) {
        ctx.addIssue({
          code: "custom",
          path: ["durationInDays"],
          message: "لا يمكن إرسال المدة وعدد الحصص معًا",
        });
      }

      if (data.type === "time_based") {
        if (data.durationInDays == null) {
          ctx.addIssue({
            code: "custom",
            path: ["durationInDays"],
            message: "المدة مطلوبة للباقات الزمنية",
          });
        }
        if (data.sessionCount != null) {
          ctx.addIssue({
            code: "custom",
            path: ["sessionCount"],
            message: "لا يمكن إرسال عدد حصص مع باقة زمنية",
          });
        }
      }

      if (data.type === "session_based") {
        if (data.sessionCount == null) {
          ctx.addIssue({
            code: "custom",
            path: ["sessionCount"],
            message: "عدد الحصص مطلوب لباقات الحصص",
          });
        }
        if (data.durationInDays != null) {
          ctx.addIssue({
            code: "custom",
            path: ["durationInDays"],
            message: "لا يمكن إرسال مدة مع باقة حصص",
          });
        }
      }
    });

  private static updatePlanBodySchema = z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "الاسم قصير جدًا")
        .max(120, "الاسم طويل جدًا")
        .optional(),
      description: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v === "" ? undefined : v)),
      price: z.coerce
        .number()
        .min(0, "السعر لا يمكن أن يكون بالسالب")
        .optional(),
      type: z.enum(["time_based", "session_based"]).optional(),
      durationInDays: z.coerce
        .number()
        .int("المدة يجب أن تكون رقمًا صحيحًا")
        .min(1, "المدة يجب أن تكون يومًا أو أكثر")
        .optional(),
      sessionCount: z.coerce
        .number()
        .int("عدد الحصص يجب أن يكون رقمًا صحيحًا")
        .min(1, "عدد الحصص يجب أن يكون 1 على الأقل")
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.durationInDays != null && data.sessionCount != null) {
        ctx.addIssue({
          code: "custom",
          path: ["durationInDays"],
          message: "لا يمكن إرسال المدة وعدد الحصص معًا",
        });
      }

      if (data.type === "time_based" && data.sessionCount != null) {
        ctx.addIssue({
          code: "custom",
          path: ["sessionCount"],
          message: "لا يمكن إرسال عدد حصص مع باقة زمنية",
        });
      }

      if (data.type === "session_based" && data.durationInDays != null) {
        ctx.addIssue({
          code: "custom",
          path: ["durationInDays"],
          message: "لا يمكن إرسال مدة مع باقة حصص",
        });
      }
    });

  public static createPlan = z.object({
    body: PlanValidation.createPlanBodySchema,
  });

  public static updatePlan = z.object({
    params: PlanValidation.idParamSchema,
    body: PlanValidation.updatePlanBodySchema,
  });

  public static planId = z.object({
    params: PlanValidation.idParamSchema,
  });
}

export type ICreatePlanDTO = z.infer<typeof PlanValidation.createPlan>["body"];
export type IUpdatePlanDTO = z.infer<typeof PlanValidation.updatePlan>["body"];
