import { Model, Optional } from "sequelize";
import { WhatsAppSessionStatus } from "./whatsapp.types";

export interface WhatsAppSessionAttributes {
  id: number;
  centerId: number;
  status: WhatsAppSessionStatus;
  phone: string | null;
  qrCodeDataUrl: string | null;
  pauseReason: string | null;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastQrAt: Date | null;
  lastHealthCheckAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppSessionCreationAttributes
  extends Optional<
    WhatsAppSessionAttributes,
    | "id"
    | "phone"
    | "qrCodeDataUrl"
    | "pauseReason"
    | "lastConnectedAt"
    | "lastDisconnectedAt"
    | "lastQrAt"
    | "lastHealthCheckAt"
    | "metadata"
    | "createdAt"
    | "updatedAt"
  > {}

class WhatsAppSession
  extends Model<WhatsAppSessionAttributes, WhatsAppSessionCreationAttributes>
  implements WhatsAppSessionAttributes
{
  public id!: number;
  public centerId!: number;
  public status!: WhatsAppSessionStatus;
  public phone!: string | null;
  public qrCodeDataUrl!: string | null;
  public pauseReason!: string | null;
  public lastConnectedAt!: Date | null;
  public lastDisconnectedAt!: Date | null;
  public lastQrAt!: Date | null;
  public lastHealthCheckAt!: Date | null;
  public metadata!: Record<string, unknown> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default WhatsAppSession;
