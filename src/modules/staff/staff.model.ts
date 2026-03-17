import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export type StaffRole = "owner" | "manager" | "receptionist";
export type StaffStatus = "active" | "inactive";

export interface StaffAttributes {
  id: number;
  centerId: number;
  name: string;
  email: string;
  phone: string | null;
  password: string;
  role: StaffRole;
  status: StaffStatus;
  lastLoginAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StaffCreationAttributes
  extends Optional<
    StaffAttributes,
    "id" | "phone" | "role" | "status" | "lastLoginAt" | "createdAt" | "updatedAt"
  > {}

class Staff
  extends Model<StaffAttributes, StaffCreationAttributes>
  implements StaffAttributes
{
  public id!: number;
  public centerId!: number;
  public name!: string;
  public email!: string;
  public phone!: string | null;
  public password!: string;
  public role!: StaffRole;
  public status!: StaffStatus;
  public lastLoginAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Staff.init(
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
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: "uq_staff_users_email",
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("owner", "manager", "receptionist"),
      allowNull: false,
      defaultValue: "receptionist",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "staff_users",
    timestamps: true,
    indexes: [
      {
        name: "idx_staff_users_center_role_status",
        fields: ["centerId", "role", "status"],
      },
      {
        name: "idx_staff_users_center_created_at",
        fields: ["centerId", "createdAt"],
      },
    ],
  },
);

export default Staff;

