import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";
import { AiPlanDeliveryChannel, AiPlanDeliveryStatus } from "./ai-plan.types";

export interface AiPlanDeliveryLogAttributes {
  id: number;
  planId: number;
  channel: AiPlanDeliveryChannel;
  status: AiPlanDeliveryStatus;
  whatsappMessageId: number | null;
  failureReason: string | null;
  sentAt: Date | null;
  createdBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiPlanDeliveryLogCreationAttributes
  extends Optional<
    AiPlanDeliveryLogAttributes,
    "id" | "whatsappMessageId" | "failureReason" | "sentAt" | "createdBy" | "createdAt" | "updatedAt"
  > {}

class AiPlanDeliveryLog
  extends Model<AiPlanDeliveryLogAttributes, AiPlanDeliveryLogCreationAttributes>
  implements AiPlanDeliveryLogAttributes
{
  public id!: number;
  public planId!: number;
  public channel!: AiPlanDeliveryChannel;
  public status!: AiPlanDeliveryStatus;
  public whatsappMessageId!: number | null;
  public failureReason!: string | null;
  public sentAt!: Date | null;
  public createdBy!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AiPlanDeliveryLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    planId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "member_ai_plans", key: "id" },
      onDelete: "CASCADE",
    },
    channel: {
      type: DataTypes.ENUM("whatsapp"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("queued", "sent", "failed"),
      allowNull: false,
    },
    whatsappMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "whatsapp_messages", key: "id" },
      onDelete: "SET NULL",
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "member_ai_plan_delivery_logs",
    timestamps: true,
    indexes: [
      {
        name: "idx_member_ai_plan_delivery_logs_plan",
        fields: ["planId", "createdAt"],
      },
    ],
  },
);

export default AiPlanDeliveryLog;
