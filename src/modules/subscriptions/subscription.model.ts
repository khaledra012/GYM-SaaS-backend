import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export interface SubscriptionAttributes {
  id: number;
  memberId: number;
  planId: number | null;
  centerId: number;
  source: "plan" | "manual";
  type: "time_based" | "session_based";
  status: "active" | "frozen" | "expired" | "cancelled";
  startDate: Date;
  endDate: Date | null;
  totalSessions: number | null;
  remainingSessions: number | null;
  pricePaidCents: number;
  notes: string | null;
  freezeCount: number;
  totalFreezeMinutes: number;
  frozenAt: Date | null;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionCreationAttributes extends Optional<
  SubscriptionAttributes,
  | "id"
  | "status"
  | "endDate"
  | "totalSessions"
  | "remainingSessions"
  | "notes"
  | "freezeCount"
  | "totalFreezeMinutes"
  | "frozenAt"
  | "version"
  | "createdAt"
  | "updatedAt"
> {}

class Subscription
  extends Model<SubscriptionAttributes, SubscriptionCreationAttributes>
  implements SubscriptionAttributes
{
  public id!: number;
  public memberId!: number;
  public planId!: number | null;
  public centerId!: number;
  public source!: "plan" | "manual";
  public type!: "time_based" | "session_based";
  public status!: "active" | "frozen" | "expired" | "cancelled";
  public startDate!: Date;
  public endDate!: Date | null;
  public totalSessions!: number | null;
  public remainingSessions!: number | null;
  public pricePaidCents!: number;
  public notes!: string | null;
  public freezeCount!: number;
  public totalFreezeMinutes!: number;
  public frozenAt!: Date | null;
  public version!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Subscription.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    memberId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "members", key: "id" },
    },
    planId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "plans", key: "id" },
    },
    centerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "centers", key: "id" },
    },
    source: {
      type: DataTypes.ENUM("plan", "manual"),
      allowNull: false,
      defaultValue: "plan",
    },
    type: {
      type: DataTypes.ENUM("time_based", "session_based"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "frozen", "expired", "cancelled"),
      allowNull: false,
      defaultValue: "active",
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    totalSessions: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    remainingSessions: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pricePaidCents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    freezeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    totalFreezeMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 2147483647,
      },
    },
    frozenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
  },
  {
    sequelize,
    tableName: "subscriptions",
    timestamps: true,
    version: true,
    validate: {
      sourcePlanConsistency(this: Subscription) {
        if (this.source === "plan" && this.planId === null) {
          throw new Error("الاشتراك المرتبط بباقة يجب أن يحتوي على معرف باقة");
        }

        if (this.source === "manual" && this.planId !== null) {
          throw new Error("الاشتراك اليدوي لا يجب أن يحتوي على معرف باقة");
        }
      },
      typeSpecificFields(this: Subscription) {
        if (this.type === "time_based") {
          if (this.endDate === null) {
            throw new Error("الاشتراك الزمني يجب أن يحتوي على تاريخ انتهاء");
          }

          if (this.endDate <= this.startDate) {
            throw new Error("تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء");
          }

          if (this.totalSessions !== null || this.remainingSessions !== null) {
            throw new Error("الاشتراك الزمني لا يجب أن يحتوي على عداد حصص");
          }
        }

        if (this.type === "session_based") {
          if (this.endDate !== null) {
            throw new Error("اشتراك الحصص لا يجب أن يحتوي على تاريخ انتهاء");
          }

          if (this.totalSessions === null || this.remainingSessions === null) {
            throw new Error("اشتراك الحصص يجب أن يحتوي على عداد حصص");
          }

          if (this.totalSessions <= 0) {
            throw new Error("إجمالي الحصص يجب أن يكون أكبر من صفر");
          }

          if (this.remainingSessions < 0) {
            throw new Error("الحصص المتبقية لا يمكن أن تكون سالبة");
          }

          if (this.remainingSessions > this.totalSessions) {
            throw new Error("الحصص المتبقية لا يمكن أن تتجاوز إجمالي الحصص");
          }
        }
      },
      frozenStateConsistency(this: Subscription) {
        if (this.status === "frozen" && this.frozenAt === null) {
          throw new Error("الاشتراك المجمد يجب أن يحتوي على تاريخ التجميد");
        }

        if (this.status !== "frozen" && this.frozenAt !== null) {
          throw new Error(
            "الاشتراك غير المجمد لا يجب أن يحتوي على تاريخ تجميد",
          );
        }
      },
    },
    indexes: [
      {
        name: "idx_subscriptions_center_id_member_id",
        fields: ["centerId", "memberId"],
      },
      {
        name: "idx_subscriptions_center_id_status_end_date",
        fields: ["centerId", "status", "endDate"],
      },
      {
        name: "idx_subscriptions_center_id_plan_id",
        fields: ["centerId", "planId"],
      },
    ],
  },
);

export default Subscription;
