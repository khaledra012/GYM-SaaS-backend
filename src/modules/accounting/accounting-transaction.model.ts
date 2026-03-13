import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../config/db.config";

export type AccountingTransactionType = "IN" | "OUT";

export type AccountingTransactionCategory =
  | "subscription"
  | "pos_sales"
  | "salaries"
  | "maintenance"
  | "rent_utilities"
  | "owner_draw"
  | "other";

export type AccountingTransactionSource =
  | "manual"
  | "automated"
  | "automated_reversal";

export interface AccountingTransactionAttributes {
  id: number;
  centerId: number;
  shiftId: number;
  type: AccountingTransactionType;
  amount: string;
  category: AccountingTransactionCategory;
  description: string | null;
  referenceType: string | null;
  referenceId: number | null;
  localDate: string;
  occurredAt: Date;
  source: AccountingTransactionSource;
  idempotencyKey: string | null;
  reversalOfTransactionId: number | null;
  createdBy: number;
  metadata: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AccountingTransactionCreationAttributes
  extends Optional<
    AccountingTransactionAttributes,
    | "id"
    | "description"
    | "referenceType"
    | "referenceId"
    | "source"
    | "idempotencyKey"
    | "reversalOfTransactionId"
    | "metadata"
    | "createdAt"
    | "updatedAt"
  > {}

class AccountingTransaction
  extends Model<
    AccountingTransactionAttributes,
    AccountingTransactionCreationAttributes
  >
  implements AccountingTransactionAttributes
{
  public id!: number;
  public centerId!: number;
  public shiftId!: number;
  public type!: AccountingTransactionType;
  public amount!: string;
  public category!: AccountingTransactionCategory;
  public description!: string | null;
  public referenceType!: string | null;
  public referenceId!: number | null;
  public localDate!: string;
  public occurredAt!: Date;
  public source!: AccountingTransactionSource;
  public idempotencyKey!: string | null;
  public reversalOfTransactionId!: number | null;
  public createdBy!: number;
  public metadata!: Record<string, any> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AccountingTransaction.init(
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
    shiftId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "shifts", key: "id" },
      onDelete: "RESTRICT",
    },
    type: {
      type: DataTypes.ENUM("IN", "OUT"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    category: {
      type: DataTypes.ENUM(
        "subscription",
        "pos_sales",
        "salaries",
        "maintenance",
        "rent_utilities",
        "owner_draw",
        "other",
      ),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    referenceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    localDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    source: {
      type: DataTypes.ENUM("manual", "automated", "automated_reversal"),
      allowNull: false,
      defaultValue: "manual",
    },
    idempotencyKey: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    reversalOfTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "transactions", key: "id" },
      onDelete: "SET NULL",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "centers", key: "id" },
      onDelete: "RESTRICT",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "transactions",
    timestamps: true,
    validate: {
      idempotencyConsistency(this: AccountingTransaction) {
        const requiresIdempotency =
          this.source === "automated" || this.source === "automated_reversal";

        if (requiresIdempotency && !this.idempotencyKey) {
          throw new Error("المعاملة التلقائية يجب أن تحتوي على مفتاح منع التكرار");
        }
      },
    },
    indexes: [
      {
        name: "uq_transactions_center_idempotency",
        unique: true,
        fields: ["centerId", "idempotencyKey"],
      },
      {
        name: "idx_transactions_center_local_date_type",
        fields: ["centerId", "localDate", "type"],
      },
      {
        name: "idx_transactions_center_shift_id",
        fields: ["centerId", "shiftId"],
      },
      {
        name: "idx_transactions_center_reference",
        fields: ["centerId", "referenceType", "referenceId"],
      },
      {
        name: "idx_transactions_reversal_of_transaction_id",
        fields: ["reversalOfTransactionId"],
      },
    ],
  },
);

export default AccountingTransaction;
