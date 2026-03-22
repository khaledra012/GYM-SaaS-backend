import { z } from "zod";

const idSchema = z.object({
  id: z.coerce
    .number({ message: "معرف الخطة يجب أن يكون رقمًا" })
    .int("معرف الخطة يجب أن يكون رقمًا صحيحًا")
    .positive("معرف الخطة يجب أن يكون أكبر من صفر"),
});

const memberIdSchema = z.object({
  memberId: z.coerce
    .number({ message: "معرف العضو يجب أن يكون رقمًا" })
    .int("معرف العضو يجب أن يكون رقمًا صحيحًا")
    .positive("معرف العضو يجب أن يكون أكبر من صفر"),
});

const planTypeSchema = z.enum(["workout_only", "nutrition_only", "combined"], {
  message: "نوع الخطة غير صالح",
});

const genderSchema = z.enum(["male", "female"], {
  message: "النوع غير صالح",
});

const statusSchema = z.enum(
  ["draft", "reviewed", "approved", "rejected", "sent_whatsapp", "archived"],
  {
    message: "حالة الخطة غير صالحة",
  },
);

const stringArraySchema = z.array(z.string().trim().min(1).max(200)).max(30).default([]);

const workoutExerciseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sets: z.string().trim().min(1).max(50),
  reps: z.string().trim().min(1).max(50),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  notes: z.string().trim().max(500).optional(),
});

const workoutDaySchema = z.object({
  dayLabel: z.string().trim().min(1).max(120),
  focus: z.string().trim().min(1).max(200),
  exercises: z.array(workoutExerciseSchema).max(20).default([]),
  notes: z.string().trim().max(500).optional(),
});

const nutritionMealSchema = z.object({
  title: z.string().trim().min(1).max(120),
  time: z.string().trim().max(80).optional(),
  items: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  notes: z.string().trim().max(500).optional(),
});

const planPayloadSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  dailyCalories: z.number().int().min(0).max(20000).nullable().optional(),
  macros: z
    .object({
      proteinGrams: z.number().min(0).max(1000),
      carbsGrams: z.number().min(0).max(2000),
      fatsGrams: z.number().min(0).max(1000),
    })
    .nullable()
    .optional(),
  workoutPlan: z.array(workoutDaySchema).max(14).default([]),
  nutritionPlan: z.array(nutritionMealSchema).max(14).default([]),
  coachNotes: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  memberInstructions: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
});

export class AiPlanValidation {
  public static generate = z.object({
    body: z.object({
      memberId: memberIdSchema.shape.memberId,
      planType: planTypeSchema,
      goal: z.string().trim().min(1).max(80),
      age: z.coerce.number().int().min(10).max(100),
      gender: genderSchema,
      weightKg: z.coerce.number().min(20).max(400),
      heightCm: z.coerce.number().min(80).max(250),
      activityLevel: z.string().trim().min(1).max(80),
      trainingDaysPerWeek: z.coerce.number().int().min(0).max(7),
      experienceLevel: z.string().trim().max(80).optional(),
      sessionDurationMinutes: z.coerce.number().int().min(15).max(300).optional(),
      mealsPerDay: z.coerce.number().int().min(1).max(10).optional(),
      foodPreferences: stringArraySchema.optional(),
      foodRestrictions: stringArraySchema.optional(),
      medicalConditions: stringArraySchema.optional(),
      injuries: stringArraySchema.optional(),
      notes: z.string().trim().max(2000).optional(),
    }),
  });

  public static getById = z.object({
    params: idSchema,
  });

  public static listByMember = z.object({
    params: memberIdSchema,
    query: z.object({
      status: statusSchema.optional(),
    }),
  });

  public static update = z.object({
    params: idSchema,
    body: z.object({
      payload: planPayloadSchema,
    }),
  });

  public static approve = z.object({
    params: idSchema,
    body: z.object({}).default({}),
  });

  public static reject = z.object({
    params: idSchema,
    body: z.object({
      reason: z.string().trim().min(1).max(1000),
    }),
  });

  public static generatePdf = z.object({
    params: idSchema,
    body: z.object({}).default({}),
  });

  public static downloadPdf = z.object({
    params: idSchema,
  });

  public static sendWhatsApp = z.object({
    params: idSchema,
    body: z.object({}).default({}),
  });
}

export type IGenerateAiPlanDTO = z.infer<typeof AiPlanValidation.generate>["body"];
export type IUpdateAiPlanDTO = z.infer<typeof AiPlanValidation.update>["body"];
export type IRejectAiPlanDTO = z.infer<typeof AiPlanValidation.reject>["body"];
export type IListMemberAiPlansQuery = z.infer<
  typeof AiPlanValidation.listByMember
>["query"];
export type IAiPlanPayload = z.infer<typeof planPayloadSchema>;
export const AiPlanPayloadSchema = planPayloadSchema;
