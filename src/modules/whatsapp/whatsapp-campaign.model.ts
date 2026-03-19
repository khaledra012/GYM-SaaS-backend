import { Model, Optional } from "sequelize";
import {
  WhatsAppCampaignAudienceType,
  WhatsAppCampaignStatus,
} from "./whatsapp.types";

export interface WhatsAppCampaignAttributes {
  id: number;
  centerId: number;
  name: string;
  audienceType: WhatsAppCampaignAudienceType;
  messageTemplate: string;
  status: WhatsAppCampaignStatus;
  totalRecipients: number;
  createdBy: number | null;
  launchedAt: Date | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppCampaignCreationAttributes
  extends Optional<
    WhatsAppCampaignAttributes,
    | "id"
    | "status"
    | "totalRecipients"
    | "createdBy"
    | "launchedAt"
    | "pausedAt"
    | "resumedAt"
    | "cancelledAt"
    | "completedAt"
    | "createdAt"
    | "updatedAt"
  > {}

class WhatsAppCampaign
  extends Model<WhatsAppCampaignAttributes, WhatsAppCampaignCreationAttributes>
  implements WhatsAppCampaignAttributes
{
  public id!: number;
  public centerId!: number;
  public name!: string;
  public audienceType!: WhatsAppCampaignAudienceType;
  public messageTemplate!: string;
  public status!: WhatsAppCampaignStatus;
  public totalRecipients!: number;
  public createdBy!: number | null;
  public launchedAt!: Date | null;
  public pausedAt!: Date | null;
  public resumedAt!: Date | null;
  public cancelledAt!: Date | null;
  public completedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default WhatsAppCampaign;
