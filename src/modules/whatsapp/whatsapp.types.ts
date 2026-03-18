export type WhatsAppSessionStatus =
  | "connecting"
  | "qr_ready"
  | "connected"
  | "degraded"
  | "paused"
  | "disconnected";

export type WhatsAppModuleStatus = "healthy" | "paused";

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
  | "manual_test";

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
