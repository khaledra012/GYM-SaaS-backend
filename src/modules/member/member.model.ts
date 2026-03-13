import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export interface MemberAttributes {
  id: number;
  code: string;
  name: string;
  phone: string;
  email?: string;
  gender: "male" | "female";
  status: "active" | "inactive" | "rejected";
  membershipStart?: string;
  centerId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MemberCreationAttributes
  extends Optional<MemberAttributes, "id" | "code" | "gender" | "status"> {}

class Member
  extends Model<MemberAttributes, MemberCreationAttributes>
  implements MemberAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public phone!: string;
  public email?: string;
  public gender!: "male" | "female";
  public status!: "active" | "inactive" | "rejected";
  public membershipStart?: string;
  public centerId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Member.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: "uq_members_code" },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    gender: { type: DataTypes.ENUM("male", "female"), defaultValue: "male" },
    status: {
      type: DataTypes.ENUM("active", "inactive", "rejected"),
      defaultValue: "active",
    },
    membershipStart: { type: DataTypes.DATEONLY, allowNull: true },
    centerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "centers",
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    sequelize,
    tableName: "members",
  },
);

export default Member;
