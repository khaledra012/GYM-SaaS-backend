import { z } from "zod";

export class StaffValidation {
  private static idParamSchema = z.object({
    id: z.coerce
      .number({ message: "المعرف يجب أن يكون رقمًا" })
      .int("المعرف يجب أن يكون رقمًا صحيحًا")
      .positive("المعرف يجب أن يكون أكبر من صفر"),
  });

  private static roleSchema = z.enum(["manager", "receptionist"], {
    message: "الدور غير صالح",
  });

  public static login = z.object({
    body: z.object({
      email: z.string().email("البريد الإلكتروني غير صحيح"),
      password: z.string().min(1, "كلمة المرور مطلوبة"),
    }),
  });

  public static createStaff = z.object({
    body: z.object({
      name: z
        .string({ message: "اسم الموظف مطلوب" })
        .trim()
        .min(2, "اسم الموظف قصير جدًا")
        .max(120, "اسم الموظف طويل جدًا"),
      email: z.string().email("البريد الإلكتروني غير صحيح"),
      phone: z
        .string()
        .trim()
        .min(8, "رقم الهاتف غير صحيح")
        .max(30, "رقم الهاتف طويل جدًا")
        .optional(),
      password: z
        .string({ message: "كلمة المرور مطلوبة" })
        .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
        .max(128, "كلمة المرور طويلة جدًا"),
      role: StaffValidation.roleSchema,
    }),
  });

  public static updateStaff = z.object({
    params: StaffValidation.idParamSchema,
    body: z
      .object({
        name: z
          .string()
          .trim()
          .min(2, "اسم الموظف قصير جدًا")
          .max(120, "اسم الموظف طويل جدًا")
          .optional(),
        email: z.string().email("البريد الإلكتروني غير صحيح").optional(),
        phone: z
          .string()
          .trim()
          .min(8, "رقم الهاتف غير صحيح")
          .max(30, "رقم الهاتف طويل جدًا")
          .optional(),
        role: StaffValidation.roleSchema.optional(),
      })
      .refine((body) => Object.keys(body).length > 0, {
        message: "لا يوجد بيانات للتعديل",
      }),
  });

  public static updateStaffStatus = z.object({
    params: StaffValidation.idParamSchema,
    body: z.object({
      status: z.enum(["active", "inactive"], {
        message: "حالة الموظف غير صالحة",
      }),
    }),
  });

  public static resetStaffPassword = z.object({
    params: StaffValidation.idParamSchema,
    body: z.object({
      password: z
        .string({ message: "كلمة المرور الجديدة مطلوبة" })
        .min(6, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل")
        .max(128, "كلمة المرور طويلة جدًا"),
    }),
  });

  public static listStaff = z.object({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      role: z.enum(["owner", "manager", "receptionist"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      search: z.string().trim().max(255, "نص البحث طويل جدًا").optional(),
    }),
  });

  public static staffId = z.object({
    params: StaffValidation.idParamSchema,
  });
}

export type IStaffLoginDTO = z.infer<typeof StaffValidation.login>["body"];
export type ICreateStaffDTO = z.infer<typeof StaffValidation.createStaff>["body"];
export type IUpdateStaffDTO = z.infer<typeof StaffValidation.updateStaff>["body"];
export type IUpdateStaffStatusDTO = z.infer<
  typeof StaffValidation.updateStaffStatus
>["body"];
export type IResetStaffPasswordDTO = z.infer<
  typeof StaffValidation.resetStaffPassword
>["body"];
export type IListStaffQuery = z.infer<typeof StaffValidation.listStaff>["query"];

