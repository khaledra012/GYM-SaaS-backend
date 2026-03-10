import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export interface PlanAttributes {
  id: number;
  name: string;
  description: string | null;
  price: string;
  type: "time_based" | "session_based";
  durationInDays: number | null;
  sessionCount: number | null;
  centerId: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface PlanCreationAttributes
  extends Optional<
    PlanAttributes,
    | "id"
    | "description"
    | "durationInDays"
    | "sessionCount"
    | "createdAt"
    | "updatedAt"
    | "deletedAt"
  > { }

class Plan
  extends Model<PlanAttributes, PlanCreationAttributes>
  implements PlanAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public price!: string;
  public type!: "time_based" | "session_based";
  public durationInDays!: number | null;
  public sessionCount!: number | null;
  public centerId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;
}

Plan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    type: {
      type: DataTypes.ENUM("time_based", "session_based"),
      allowNull: false,
    },

    durationInDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
      },
    },

    sessionCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
      },
    },

    centerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "plans",
    timestamps: true,
    // Soft delete - Sequelize يضيف deletedAt تلقائيًا
    paranoid: true,

    indexes: [
      { name: "idx_plans_center_id", fields: ["centerId"] },
    ],
  },
);

export default Plan;

