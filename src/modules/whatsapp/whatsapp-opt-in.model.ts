import { Model, Optional } from "sequelize";

export interface WhatsAppOptInAttributes {
  id: number;
  centerId: number;
  memberId: number;
  isOptedIn: boolean;
  source: string | null;
  updatedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppOptInCreationAttributes
  extends Optional<
    WhatsAppOptInAttributes,
    "id" | "source" | "updatedBy" | "createdAt" | "updatedAt"
  > {}

class WhatsAppOptIn
  extends Model<WhatsAppOptInAttributes, WhatsAppOptInCreationAttributes>
  implements WhatsAppOptInAttributes
{
  public id!: number;
  public centerId!: number;
  public memberId!: number;
  public isOptedIn!: boolean;
  public source!: string | null;
  public updatedBy!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default WhatsAppOptIn;
