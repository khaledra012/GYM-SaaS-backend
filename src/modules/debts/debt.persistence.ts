import { DataTypes, Sequelize } from "sequelize";
import sequelize from "../../config/db.config";
import Debt from "./debt.model";
import DebtPayment from "./debt-payment.model";
import { resolveDebtStatus } from "./debt.util";

let initialized = false;

export const initDebtModels = (db: Sequelize = sequelize) => {
  if (initialized) {
    return;
  }

  Debt.init(
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
        allowNull: false,
        references: { model: "members", key: "id" },
        onDelete: "CASCADE",
      },
      source: {
        type: DataTypes.ENUM("manual", "subscription"),
        allowNull: false,
      },
      referenceType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      referenceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING(191),
        allowNull: false,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      originalAmountCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      paidAmountCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      remainingAmountCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      status: {
        type: DataTypes.ENUM("unpaid", "partially_paid", "paid"),
        allowNull: false,
        defaultValue: "unpaid",
      },
      localDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "centers", key: "id" },
        onDelete: "RESTRICT",
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize: db,
      tableName: "debts",
      timestamps: true,
      version: true,
      validate: {
        amountConsistency(this: Debt) {
          if (this.paidAmountCents > this.originalAmountCents) {
            throw new Error("المبلغ المسدد لا يمكن أن يتجاوز أصل المديونية");
          }

          if (
            this.remainingAmountCents !==
            this.originalAmountCents - this.paidAmountCents
          ) {
            throw new Error("الرصيد المتبقي غير متسق مع أصل المديونية والمسدّد");
          }

          const expectedStatus = resolveDebtStatus(
            this.paidAmountCents,
            this.remainingAmountCents,
          );

          if (this.status !== expectedStatus) {
            throw new Error("حالة المديونية لا تتوافق مع المبالغ الحالية");
          }

          if (this.source === "subscription" && (!this.referenceType || !this.referenceId)) {
            throw new Error("المديونية التلقائية يجب أن تكون مرتبطة بمرجع واضح");
          }
        },
      },
      indexes: [
        {
          name: "idx_debts_center_status_local_date",
          fields: ["centerId", "status", "localDate"],
        },
        {
          name: "idx_debts_center_member",
          fields: ["centerId", "memberId"],
        },
        {
          name: "idx_debts_center_reference",
          fields: ["centerId", "referenceType", "referenceId"],
        },
      ],
    },
  );

  DebtPayment.init(
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
      debtId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "debts", key: "id" },
        onDelete: "CASCADE",
      },
      type: {
        type: DataTypes.ENUM("cash", "adjustment"),
        allowNull: false,
      },
      amountCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      affectsAccounting: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      localDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "centers", key: "id" },
        onDelete: "RESTRICT",
      },
      accountingTransactionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "transactions", key: "id" },
        onDelete: "SET NULL",
      },
    },
    {
      sequelize: db,
      tableName: "debt_payments",
      timestamps: true,
      validate: {
        paymentTypeConsistency(this: DebtPayment) {
          if (this.type === "cash" && !this.affectsAccounting) {
            throw new Error("السداد النقدي يجب أن يؤثر على الحسابات");
          }

          if (this.type === "adjustment" && this.affectsAccounting) {
            throw new Error("التسوية النظامية لا يجب أن تؤثر على الحسابات");
          }
        },
      },
      indexes: [
        {
          name: "idx_debt_payments_center_debt",
          fields: ["centerId", "debtId"],
        },
        {
          name: "idx_debt_payments_center_local_date",
          fields: ["centerId", "localDate"],
        },
      ],
    },
  );

  initialized = true;
};

