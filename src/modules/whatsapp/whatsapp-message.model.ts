import { Model, Optional } from "sequelize";
import {
  WhatsAppFailureType,
  WhatsAppMessageStatus,
  WhatsAppTemplateEventType,
} from "./whatsapp.types";

export interface WhatsAppMessageAttributes {
  id: number;
  centerId: number;
  sessionId: number | null;
  memberId: number | null;
  campaignId: number | null;
  eventType: WhatsAppTemplateEventType;
  templateId: number | null;
  dedupeKey: string | null;
  phone: string;
  renderedBody: string;
  status: WhatsAppMessageStatus;
  failureType: WhatsAppFailureType | null;
  failureCode: string | null;
  failureReason: string | null;
  attempts: number;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppMessageCreationAttributes
  extends Optional<
    WhatsAppMessageAttributes,
    | "id"
    | "sessionId"
    | "memberId"
    | "campaignId"
    | "templateId"
    | "dedupeKey"
    | "failureType"
    | "failureCode"
    | "failureReason"
    | "attempts"
    | "nextAttemptAt"
    | "lastAttemptAt"
    | "sentAt"
    | "metadata"
    | "createdAt"
    | "updatedAt"
  > {}

class WhatsAppMessage
  extends Model<WhatsAppMessageAttributes, WhatsAppMessageCreationAttributes>
  implements WhatsAppMessageAttributes
{
  public id!: number;
  public centerId!: number;
  public sessionId!: number | null;
  public memberId!: number | null;
  public campaignId!: number | null;
  public eventType!: WhatsAppTemplateEventType;
  public templateId!: number | null;
  public dedupeKey!: string | null;
  public phone!: string;
  public renderedBody!: string;
  public status!: WhatsAppMessageStatus;
  public failureType!: WhatsAppFailureType | null;
  public failureCode!: string | null;
  public failureReason!: string | null;
  public attempts!: number;
  public nextAttemptAt!: Date | null;
  public lastAttemptAt!: Date | null;
  public sentAt!: Date | null;
  public metadata!: Record<string, unknown> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default WhatsAppMessage;
