import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export type CheckinStatus = "approved" | "denied";

export type CheckinDenyReasonCode =
  | "member_not_found"
  | "member_inactive"
  | "no_subscription"
  | "subscription_expired"
  | "subscription_frozen"
  | "subscription_cancelled"
  | "sessions_depleted"
  | "cooldown_active"
  | "concurrency_conflict";

export interface CheckinAttributes {
  id: number;
  centerId: number;
  memberId: number | null;
  subscriptionId: number | null;
  memberCode: string;
  status: CheckinStatus;
  denyReasonCode: CheckinDenyReasonCode | null;
  denyReasonMessage: string | null;
  checkinAt: Date;
  localDate: string;
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CheckinCreationAttributes
  extends Optional<
    CheckinAttributes,
    | "id"
    | "memberId"
    | "subscriptionId"
    | "denyReasonCode"
    | "denyReasonMessage"
    | "metadata"
    | "createdAt"
    | "updatedAt"
  > {}

class Checkin
  extends Model<CheckinAttributes, CheckinCreationAttributes>
  implements CheckinAttributes
{
  public id!: number;
  public centerId!: number;
  public memberId!: number | null;
  public subscriptionId!: number | null;
  public memberCode!: string;
  public status!: CheckinStatus;
  public denyReasonCode!: CheckinDenyReasonCode | null;
  public denyReasonMessage!: string | null;
  public checkinAt!: Date;
  public localDate!: string;
  public metadata!: Record<string, any>;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Checkin.init(
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
      allowNull: true,
      references: { model: "members", key: "id" },
      onDelete: "SET NULL",
    },
    subscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "subscriptions", key: "id" },
      onDelete: "SET NULL",
    },
    memberCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("approved", "denied"),
      allowNull: false,
    },
    denyReasonCode: {
      type: DataTypes.ENUM(
        "member_not_found",
        "member_inactive",
        "no_subscription",
        "subscription_expired",
        "subscription_frozen",
        "subscription_cancelled",
        "sessions_depleted",
        "cooldown_active",
        "concurrency_conflict",
      ),
      allowNull: true,
    },
    denyReasonMessage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    checkinAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    localDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    tableName: "checkins",
    timestamps: true,
    validate: {
      denyConsistency(this: Checkin) {
        if (this.status === "approved") {
          if (this.denyReasonCode !== null || this.denyReasonMessage !== null) {
            throw new Error("محاولة الدخول المقبولة لا يجب أن تحتوي على سبب رفض");
          }
        }

        if (this.status === "denied") {
          if (!this.denyReasonCode || !this.denyReasonMessage) {
            throw new Error("محاولة الدخول المرفوضة يجب أن تحتوي على سبب واضح");
          }
        }
      },
    },
    indexes: [
      {
        name: "idx_checkins_center_id_checkin_at",
        fields: ["centerId", "checkinAt"],
      },
      {
        name: "idx_checkins_center_id_member_id_checkin_at",
        fields: ["centerId", "memberId", "checkinAt"],
      },
      {
        name: "idx_checkins_center_id_local_date",
        fields: ["centerId", "localDate"],
      },
      {
        name: "idx_checkins_center_id_status_local_date",
        fields: ["centerId", "status", "localDate"],
      },
    ],
  },
);

export default Checkin;
