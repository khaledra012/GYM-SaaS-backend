export type AiPlanType = "workout_only" | "nutrition_only" | "combined";

export type AiPlanStatus =
  | "draft"
  | "reviewed"
  | "approved"
  | "rejected"
  | "sent_whatsapp"
  | "archived";

export type AiPlanVersionSource =
  | "ai_generated"
  | "coach_edited"
  | "approved_snapshot"
  | "rejected_snapshot";

export type AiPlanDeliveryChannel = "whatsapp";

export type AiPlanDeliveryStatus = "queued" | "sent" | "failed";
