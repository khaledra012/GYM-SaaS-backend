export type WhatsAppSessionStatus =
  | "connecting"
  | "qr_ready"
  | "connected"
  | "degraded"
  | "paused"
  | "disconnected";

export type WhatsAppModuleStatus = "healthy" | "paused";

export type WhatsAppCampaignStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type WhatsAppCampaignAudienceType =
  | "all_members"
  | "active_subscriptions"
  | "expired_subscriptions";

export type WhatsAppMessageStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed_retryable"
  | "deferred"
  | "permanent_failed";

export type WhatsAppFailureType = "retryable" | "fatal";

export type WhatsAppTemplateEventType =
  | "member_welcome"
  | "subscription_expiry"
  | "debt_created"
  | "payment_receipt"
  | "debt_follow_up"
  | "manual_test"
  | "campaign_broadcast"
  | "ai_plan_pdf";

export type WhatsAppDeliveryStatus =
  | "queued"
  | "processing"
  | "sent"
  | "failed_retryable"
  | "deferred"
  | "permanent_failed";

export interface IClassifiedWhatsAppFailure {
  failureType: WhatsAppFailureType;
  failureCode: string;
  failureReason: string;
}
