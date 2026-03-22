import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";
import { AiPlanVersionSource } from "./ai-plan.types";

export interface AiPlanVersionAttributes {
  id: number;
  planId: number;
  versionNumber: number;
  source: AiPlanVersionSource;
  payload: Record<string, unknown>;
  createdBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AiPlanVersionCreationAttributes
  extends Optional<AiPlanVersionAttributes, "id" | "createdAt" | "updatedAt"> {}

class AiPlanVersion
  extends Model<AiPlanVersionAttributes, AiPlanVersionCreationAttributes>
  implements AiPlanVersionAttributes
{
  public id!: number;
  public planId!: number;
  public versionNumber!: number;
  public source!: AiPlanVersionSource;
  public payload!: Record<string, unknown>;
  public createdBy!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AiPlanVersion.init(
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
    versionNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    source: {
      type: DataTypes.ENUM(
        "ai_generated",
        "coach_edited",
        "approved_snapshot",
        "rejected_snapshot",
      ),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "member_ai_plan_versions",
    timestamps: true,
    indexes: [
      {
        name: "idx_member_ai_plan_versions_plan",
        fields: ["planId", "versionNumber"],
      },
    ],
  },
);

export default AiPlanVersion;
