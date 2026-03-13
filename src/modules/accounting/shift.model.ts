import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export type ShiftStatus = "open" | "closed";

export interface ShiftAttributes {
  id: number;
  centerId: number;
  status: ShiftStatus;
  localDate: string;
  startingCash: string;
  expectedEndingCash: string;
  actualEndingCash: string | null;
  discrepancy: string | null;
  openedAt: Date;
  closedAt: Date | null;
  openedBy: number;
  closedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShiftCreationAttributes
  extends Optional<
    ShiftAttributes,
    | "id"
    | "status"
    | "actualEndingCash"
    | "discrepancy"
    | "closedAt"
    | "closedBy"
    | "createdAt"
    | "updatedAt"
  > {}

class Shift
  extends Model<ShiftAttributes, ShiftCreationAttributes>
  implements ShiftAttributes
{
  public id!: number;
  public centerId!: number;
  public status!: ShiftStatus;
  public localDate!: string;
  public startingCash!: string;
  public expectedEndingCash!: string;
  public actualEndingCash!: string | null;
  public discrepancy!: string | null;
  public openedAt!: Date;
  public closedAt!: Date | null;
  public openedBy!: number;
  public closedBy!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Shift.init(
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
    status: {
      type: DataTypes.ENUM("open", "closed"),
      allowNull: false,
      defaultValue: "open",
    },
    localDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    startingCash: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    expectedEndingCash: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    actualEndingCash: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    discrepancy: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    openedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    openedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "centers", key: "id" },
      onDelete: "RESTRICT",
    },
    closedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "centers", key: "id" },
      onDelete: "SET NULL",
    },
  },
  {
    sequelize,
    tableName: "shifts",
    timestamps: true,
    validate: {
      statusConsistency(this: Shift) {
        if (this.status === "open") {
          if (this.closedAt !== null || this.actualEndingCash !== null || this.discrepancy !== null) {
            throw new Error("الوردية المفتوحة لا يجب أن تحتوي على بيانات إغلاق");
          }
        }

        if (this.status === "closed") {
          if (this.closedAt === null || this.actualEndingCash === null || this.discrepancy === null) {
            throw new Error("الوردية المغلقة يجب أن تحتوي على بيانات الإغلاق كاملة");
          }
        }
      },
    },
    indexes: [
      {
        name: "idx_shifts_center_status",
        fields: ["centerId", "status"],
      },
      {
        name: "idx_shifts_center_local_date",
        fields: ["centerId", "localDate"],
      },
      {
        name: "idx_shifts_center_opened_at",
        fields: ["centerId", "openedAt"],
      },
    ],
  },
);

export default Shift;
