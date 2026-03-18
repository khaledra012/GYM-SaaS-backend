import { Model, Optional } from "sequelize";
import { WhatsAppTemplateEventType } from "./whatsapp.types";

export interface WhatsAppTemplateAttributes {
  id: number;
  centerId: number | null;
  eventType: WhatsAppTemplateEventType;
  name: string;
  body: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppTemplateCreationAttributes
  extends Optional<
    WhatsAppTemplateAttributes,
    "id" | "centerId" | "isActive" | "createdAt" | "updatedAt"
  > {}

class WhatsAppTemplate
  extends Model<WhatsAppTemplateAttributes, WhatsAppTemplateCreationAttributes>
  implements WhatsAppTemplateAttributes
{
  public id!: number;
  public centerId!: number | null;
  public eventType!: WhatsAppTemplateEventType;
  public name!: string;
  public body!: string;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default WhatsAppTemplate;
