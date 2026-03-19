import { Model, Optional } from "sequelize";
import { WhatsAppDeliveryStatus } from "./whatsapp.types";

export interface WhatsAppDeliveryLogAttributes {
  id: number;
  centerId: number;
  messageId: number;
  sessionId: number | null;
  status: WhatsAppDeliveryStatus;
  details: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppDeliveryLogCreationAttributes
  extends Optional<
    WhatsAppDeliveryLogAttributes,
    "id" | "sessionId" | "details" | "createdAt" | "updatedAt"
  > {}

class WhatsAppDeliveryLog
  extends Model<
    WhatsAppDeliveryLogAttributes,
    WhatsAppDeliveryLogCreationAttributes
  >
  implements WhatsAppDeliveryLogAttributes
{
  public id!: number;
  public centerId!: number;
  public messageId!: number;
  public sessionId!: number | null;
  public status!: WhatsAppDeliveryStatus;
  public details!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default WhatsAppDeliveryLog;
