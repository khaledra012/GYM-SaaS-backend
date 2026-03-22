import { WhatsAppTemplateEventType } from "./whatsapp.types";

export interface IDefaultWhatsAppTemplate {
  eventType: WhatsAppTemplateEventType;
  name: string;
  body: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: IDefaultWhatsAppTemplate[] = [
  {
    eventType: "member_welcome",
    name: "ط±ط³ط§ظ„ط© طھط±ط­ظٹط¨",
    body:
      "{ط£ظ‡ظ„ط§ظ‹|ظ…ط±ط­ط¨ظ‹ط§|ظٹط§ ط¨ط·ظ„} {{name}} ظپظٹ {{gym_name}}. طھظ… طھط³ط¬ظٹظ„ظƒ ط¨ظ†ط¬ط§ط­ ظˆظ†ظˆط±طھظ†ط§. ظƒظˆط¯ ط§ظ„ط¹ط¶ظˆظٹط© ط§ظ„ط®ط§طµ ط¨ظƒ ظ‡ظˆ {{member_code}}.",
  },
  {
    eventType: "subscription_expiry",
    name: "طھط°ظƒظٹط± ط§ظ†طھظ‡ط§ط، ط§ظ„ط§ط´طھط±ط§ظƒ",
    body:
      "ظٹط§ ظƒظˆطھط´ {{name}}طŒ ط­ط§ط¨ظٹظ† ظ†ظپظƒط±ظƒ ط¥ظ† ط§ط´طھط±ط§ظƒظƒ ظ‡ظٹظ†طھظ‡ظٹ ط®ظ„ط§ظ„ {{remaining_value}} {{remaining_unit_label}} ظپظٹ {{gym_name}}.",
  },
  {
    eventType: "debt_created",
    name: "ط¥ط®ط·ط§ط± ظ…ط¯ظٹظˆظ†ظٹط©",
    body:
      "طھظ… طھط³ط¬ظٹظ„ ظ…ط¯ظٹظˆظ†ظٹط© ط¨ظ‚ظٹظ…ط© {{amount}} ط¬ظ†ظٹظ‡ ط¹ظ„ظ‰ ط­ط³ط§ط¨ظƒ ظٹط§ {{name}}. ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…طھط¨ظ‚ظٹ {{outstanding_amount}} ط¬ظ†ظٹظ‡.",
  },
  {
    eventType: "payment_receipt",
    name: "ط¥ظٹطµط§ظ„ ط§ط³طھظ„ط§ظ…",
    body:
      "ط´ظƒط±ظ‹ط§ ظ„ظƒ ظٹط§ {{name}}. طھظ… ط§ط³طھظ„ط§ظ… ظ…ط¨ظ„ط؛ {{amount}} ط¬ظ†ظٹظ‡ ط¨ظ†ط¬ط§ط­. ط§ظ„ط±طµظٹط¯ ط§ظ„ظ…طھط¨ظ‚ظٹ {{remaining_balance}} ط¬ظ†ظٹظ‡.",
  },
  {
    eventType: "debt_follow_up",
    name: "طھط°ظƒظٹط± ط¯ظˆط±ظٹ ط¨ط§ظ„ظ…ط¯ظٹظˆظ†ظٹط©",
    body:
      "طھط°ظƒظٹط± ظˆط¯ظٹ ظٹط§ {{name}}: ظ…طھط¨ظ‚ظٹ ظ…ط¯ظٹظˆظ†ظٹط© ط³ط§ط¨ظ‚ط© ط¨ظ‚ظٹظ…ط© {{outstanding_amount}} ط¬ظ†ظٹظ‡. ظ†ظ†طھط¸ط± ط³ط¯ط§ط¯ظ‡ط§ ظپظٹ ط£ظ‚ط±ط¨ ظˆظ‚طھ.",
  },
  {
    eventType: "manual_test",
    name: "ط±ط³ط§ظ„ط© ط§ط®طھط¨ط§ط±",
    body: "ظ‡ط°ظ‡ ط±ط³ط§ظ„ط© ط§ط®طھط¨ط§ط± ظ…ظ† ظ†ط¸ط§ظ… {{gym_name}}.",
  },
  {
    eventType: "campaign_broadcast",
    name: "ط­ظ…ظ„ط© ط¹ط§ظ…ط©",
    body: "ظ…ط±ط­ط¨ظ‹ط§ {{name}}طŒ ظ‡ط°ظ‡ ط±ط³ط§ظ„ط© ظ…ظ† {{gym_name}}.",
  },
  {
    eventType: "ai_plan_pdf",
    name: "إرسال ملف الخطة",
    body:
      "أهلاً {{name}}، تم تجهيز خطتك الجديدة واعتمادها من الكوتش في {{gym_name}}. ستجد ملف الخطة مرفقًا بهذه الرسالة.",
  },
];
