import { WhatsAppTemplateEventType } from "./whatsapp.types";

export interface IDefaultWhatsAppTemplate {
  eventType: WhatsAppTemplateEventType;
  name: string;
  body: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: IDefaultWhatsAppTemplate[] = [
  {
    eventType: "member_welcome",
    name: "رسالة ترحيب",
    body:
      "{أهلاً|مرحبًا|يا بطل} {{name}} في {{gym_name}}. تم تسجيلك بنجاح ونورتنا. كود العضوية الخاص بك هو {{member_code}}.",
  },
  {
    eventType: "subscription_expiry",
    name: "تذكير انتهاء الاشتراك",
    body:
      "يا كوتش {{name}}، حابين نفكرك إن اشتراكك هينتهي خلال {{remaining_value}} {{remaining_unit_label}} في {{gym_name}}.",
  },
  {
    eventType: "debt_created",
    name: "إخطار مديونية",
    body:
      "تم تسجيل مديونية بقيمة {{amount}} جنيه على حسابك يا {{name}}. إجمالي المتبقي {{outstanding_amount}} جنيه.",
  },
  {
    eventType: "payment_receipt",
    name: "إيصال استلام",
    body:
      "شكرًا لك يا {{name}}. تم استلام مبلغ {{amount}} جنيه بنجاح. الرصيد المتبقي {{remaining_balance}} جنيه.",
  },
  {
    eventType: "debt_follow_up",
    name: "تذكير دوري بالمديونية",
    body:
      "تذكير ودي يا {{name}}: متبقي مديونية سابقة بقيمة {{outstanding_amount}} جنيه. ننتظر سدادها في أقرب وقت.",
  },
  {
    eventType: "manual_test",
    name: "رسالة اختبار",
    body: "هذه رسالة اختبار من نظام {{gym_name}}.",
  },
  {
    eventType: "campaign_broadcast",
    name: "حملة عامة",
    body: "مرحبًا {{name}}، هذه رسالة من {{gym_name}}.",
  },
];
