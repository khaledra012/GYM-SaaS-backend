import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export interface CenterAttributes {
  id: number;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  timezone: string;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CenterCreationAttributes
  extends Optional<CenterAttributes, "id"> {}

class Center
  extends Model<CenterAttributes, CenterCreationAttributes>
  implements CenterAttributes
{
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public phone!: string;
  public timezone!: string;
  public passwordResetToken!: string | null;
  public passwordResetExpires!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Center.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: "uq_centers_email" },
    password: { type: DataTypes.STRING, allowNull: false },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "UTC",
    },
    passwordResetToken: { type: DataTypes.STRING, allowNull: true },
    passwordResetExpires: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "centers",
  },
);

export default Center;

