import { Model, Optional } from "sequelize";
import { DebtPaymentType } from "./debt.types";

export interface DebtPaymentAttributes {
  id: number;
  centerId: number;
  debtId: number;
  type: DebtPaymentType;
  amountCents: number;
  note: string | null;
  affectsAccounting: boolean;
  paidAt: Date;
  localDate: string;
  createdBy: number;
  accountingTransactionId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DebtPaymentCreationAttributes
  extends Optional<
    DebtPaymentAttributes,
    | "id"
    | "note"
    | "accountingTransactionId"
    | "createdAt"
    | "updatedAt"
  > {}

class DebtPayment
  extends Model<DebtPaymentAttributes, DebtPaymentCreationAttributes>
  implements DebtPaymentAttributes
{
  public id!: number;
  public centerId!: number;
  public debtId!: number;
  public type!: DebtPaymentType;
  public amountCents!: number;
  public note!: string | null;
  public affectsAccounting!: boolean;
  public paidAt!: Date;
  public localDate!: string;
  public createdBy!: number;
  public accountingTransactionId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default DebtPayment;
