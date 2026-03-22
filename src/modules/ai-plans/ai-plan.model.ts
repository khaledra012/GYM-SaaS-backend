import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";
import { AiPlanStatus, AiPlanType } from "./ai-plan.types";

export interface AiPlanAttributes {
  id: number;
  centerId: number;
  memberId: number;
  planType: AiPlanType;
  status: AiPlanStatus;
  goal: string;
  inputSnapshot: Record<string, unknown>;
  aiOutput: Record<string, unknown>;
  coachEditedOutput: Record<string, unknown> | null;
  riskFlags: string[];
  warnings: string[];
  approvedBy: number | null;
  approvedAt: Date | null;
  rejectedBy: number | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  pdfPath: string | null;
  sentAt: Date | null;
  createdBy: number;
  updatedBy: number | null;
  localDate: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiPlanCreationAttributes
  extends Optional<
    AiPlanAttributes,
    | "id"
    | "status"
    | "coachEditedOutput"
    | "riskFlags"
    | "warnings"
    | "approvedBy"
    | "approvedAt"
    | "rejectedBy"
    | "rejectedAt"
    | "rejectionReason"
    | "pdfPath"
    | "sentAt"
    | "updatedBy"
    | "createdAt"
    | "updatedAt"
  > {}

class AiPlan
  extends Model<AiPlanAttributes, AiPlanCreationAttributes>
  implements AiPlanAttributes
{
  public id!: number;
  public centerId!: number;
  public memberId!: number;
  public planType!: AiPlanType;
  public status!: AiPlanStatus;
  public goal!: string;
  public inputSnapshot!: Record<string, unknown>;
  public aiOutput!: Record<string, unknown>;
  public coachEditedOutput!: Record<string, unknown> | null;
  public riskFlags!: string[];
  public warnings!: string[];
  public approvedBy!: number | null;
  public approvedAt!: Date | null;
  public rejectedBy!: number | null;
  public rejectedAt!: Date | null;
  public rejectionReason!: string | null;
  public pdfPath!: string | null;
  public sentAt!: Date | null;
  public createdBy!: number;
  public updatedBy!: number | null;
  public localDate!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AiPlan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    centerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "centers", key: "id" },
      onDelete: "CASCADE",
    },
    memberId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "members", key: "id" },
      onDelete: "CASCADE",
    },
    planType: {
      type: DataTypes.ENUM("workout_only", "nutrition_only", "combined"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "draft",
        "reviewed",
        "approved",
        "rejected",
        "sent_whatsapp",
        "archived",
      ),
      allowNull: false,
      defaultValue: "draft",
    },
    goal: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    inputSnapshot: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    aiOutput: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    coachEditedOutput: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    riskFlags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    warnings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pdfPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    localDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "member_ai_plans",
    timestamps: true,
    indexes: [
      {
        name: "idx_member_ai_plans_center_member",
        fields: ["centerId", "memberId", "createdAt"],
      },
      {
        name: "idx_member_ai_plans_center_status",
        fields: ["centerId", "status", "createdAt"],
      },
    ],
  },
);

export default AiPlan;
