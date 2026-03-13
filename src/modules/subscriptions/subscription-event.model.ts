import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export interface SubscriptionEventAttributes {
  id: number;
  subscriptionId: number;
  centerId: number;
  eventType:
    | "created"
    | "renewed"
    | "frozen"
    | "unfrozen"
    | "cancelled"
    | "refunded"
    | "expired"
    | "session_used"
    | "session_deducted";
  metadata: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionEventCreationAttributes
  extends Optional<SubscriptionEventAttributes, "id" | "createdAt" | "updatedAt"> {}

class SubscriptionEvent
  extends Model<SubscriptionEventAttributes, SubscriptionEventCreationAttributes>
  implements SubscriptionEventAttributes
{
  public id!: number;
  public subscriptionId!: number;
  public centerId!: number;
  public eventType!:
    | "created"
    | "renewed"
    | "frozen"
    | "unfrozen"
    | "cancelled"
    | "refunded"
    | "expired"
    | "session_used"
    | "session_deducted";
  public metadata!: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SubscriptionEvent.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "subscriptions", key: "id" },
      onDelete: "CASCADE",
    },
    centerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "centers", key: "id" },
      onDelete: "CASCADE",
    },
    eventType: {
      type: DataTypes.ENUM(
        "created",
        "renewed",
        "frozen",
        "unfrozen",
        "cancelled",
        "refunded",
        "expired",
        "session_used",
        "session_deducted",
      ),
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "subscription_events",
    timestamps: true,
    indexes: [
      {
        name: "idx_subscription_events_subscription_id",
        fields: ["subscriptionId"],
      },
      {
        name: "idx_subscription_events_center_id",
        fields: ["centerId"],
      },
    ],
  },
);

export default SubscriptionEvent;
