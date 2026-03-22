import { z } from "zod";

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

const campaignIdSchema = z.object({
  id: z.coerce
    .number({ message: "معرف الحملة يجب أن يكون رقمًا" })
    .int("معرف الحملة يجب أن يكون رقمًا صحيحًا")
    .positive("معرف الحملة يجب أن يكون أكبر من صفر"),
});

const messageStatusSchema = z.enum(
  [
    "pending",
    "processing",
    "sent",
    "failed_retryable",
    "deferred",
    "permanent_failed",
  ],
  {
    message: "حالة الرسالة غير صالحة",
  },
);

const messageEventTypeSchema = z.enum(
  [
    "member_welcome",
    "subscription_expiry",
    "debt_created",
    "payment_receipt",
    "debt_follow_up",
    "manual_test",
    "campaign_broadcast",
    "ai_plan_pdf",
  ],
  {
    message: "نوع الرسالة غير صالح",
  },
);

const campaignAudienceTypeSchema = z.enum(
  ["all_members", "active_subscriptions", "expired_subscriptions"],
  {
    message: "فئة الحملة غير صالحة",
  },
);

const campaignStatusSchema = z.enum(
  ["queued", "running", "paused", "completed", "cancelled"],
  {
    message: "حالة الحملة غير صالحة",
  },
);

export class WhatsAppValidation {
  public static connectSession = z.object({
    body: z.object({}).default({}),
  });

  public static getSessionStatus = z.object({
    query: z.object({}).default({}),
  });

  public static disconnectSession = z.object({
    body: z.object({}).default({}),
  });

  public static resumeModule = z.object({
    body: z.object({}).default({}),
  });

  public static sendTestMessage = z.object({
    body: z.object({
      phone: z
        .string({ message: "رقم الهاتف مطلوب" })
        .trim()
        .min(6, "رقم الهاتف غير صالح")
        .max(30, "رقم الهاتف غير صالح"),
      message: z
        .string()
        .trim()
        .min(1, "نص الرسالة مطلوب")
        .max(2000, "نص الرسالة طويل جدًا")
        .optional(),
    }),
  });

  public static listMessages = z.object({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: messageStatusSchema.optional(),
      eventType: messageEventTypeSchema.optional(),
      memberId: memberIdSchema.shape.memberId.optional(),
      campaignId: campaignIdSchema.shape.id.optional(),
    }),
  });

  public static listTemplates = z.object({
    query: z.object({}).default({}),
  });

  public static createTemplate = z.object({
    body: z.object({
      eventType: messageEventTypeSchema,
      name: z
        .string({ message: "اسم القالب مطلوب" })
        .trim()
        .min(1, "اسم القالب مطلوب")
        .max(120, "اسم القالب طويل جدًا"),
      body: z
        .string({ message: "نص القالب مطلوب" })
        .trim()
        .min(1, "نص القالب مطلوب")
        .max(4000, "نص القالب طويل جدًا"),
      isActive: z.boolean().optional(),
    }),
  });

  public static updateTemplate = z.object({
    params: idSchema,
    body: z.object({
      name: z.string().trim().min(1, "اسم القالب مطلوب").max(120).optional(),
      body: z.string().trim().min(1, "نص القالب مطلوب").max(4000).optional(),
      isActive: z.boolean().optional(),
    }),
  });

  public static getMemberOptIn = z.object({
    params: memberIdSchema,
  });

  public static updateMemberOptIn = z.object({
    params: memberIdSchema,
    body: z.object({
      isOptedIn: z.boolean({
        message: "قيمة الإذن يجب أن تكون صحيحة أو خاطئة",
      }),
      source: z.string().trim().max(80, "المصدر طويل جدًا").optional(),
    }),
  });

  public static previewCampaign = z.object({
    body: z.object({
      audienceType: campaignAudienceTypeSchema,
      message: z
        .string({ message: "نص الرسالة مطلوب" })
        .trim()
        .min(1, "نص الرسالة مطلوب")
        .max(4000, "نص الرسالة طويل جدًا"),
      name: z
        .string()
        .trim()
        .min(1, "اسم الحملة مطلوب")
        .max(160, "اسم الحملة طويل جدًا")
        .optional(),
    }),
  });

  public static createCampaign = z.object({
    body: z.object({
      audienceType: campaignAudienceTypeSchema,
      message: z
        .string({ message: "نص الرسالة مطلوب" })
        .trim()
        .min(1, "نص الرسالة مطلوب")
        .max(4000, "نص الرسالة طويل جدًا"),
      name: z
        .string()
        .trim()
        .min(1, "اسم الحملة مطلوب")
        .max(160, "اسم الحملة طويل جدًا")
        .optional(),
    }),
  });

  public static listCampaigns = z.object({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: campaignStatusSchema.optional(),
    }),
  });

  public static getCampaignById = z.object({
    params: campaignIdSchema,
  });

  public static pauseCampaign = z.object({
    params: campaignIdSchema,
    body: z.object({}).default({}),
  });

  public static resumeCampaign = z.object({
    params: campaignIdSchema,
    body: z.object({}).default({}),
  });

  public static cancelCampaign = z.object({
    params: campaignIdSchema,
    body: z.object({}).default({}),
  });
}

export type IListWhatsAppMessagesQuery = z.infer<
  typeof WhatsAppValidation.listMessages
>["query"];
export type ISendWhatsAppTestMessageDTO = z.infer<
  typeof WhatsAppValidation.sendTestMessage
>["body"];
export type ICreateWhatsAppTemplateDTO = z.infer<
  typeof WhatsAppValidation.createTemplate
>["body"];
export type IUpdateWhatsAppTemplateDTO = z.infer<
  typeof WhatsAppValidation.updateTemplate
>["body"];
export type IUpdateWhatsAppOptInDTO = z.infer<
  typeof WhatsAppValidation.updateMemberOptIn
>["body"];
export type IPreviewWhatsAppCampaignDTO = z.infer<
  typeof WhatsAppValidation.previewCampaign
>["body"];
export type ICreateWhatsAppCampaignDTO = z.infer<
  typeof WhatsAppValidation.createCampaign
>["body"];
export type IListWhatsAppCampaignsQuery = z.infer<
  typeof WhatsAppValidation.listCampaigns
>["query"];
