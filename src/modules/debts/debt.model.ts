import { Model, Optional } from "sequelize";
import { DebtSource, DebtStatus } from "./debt.types";

export interface DebtAttributes {
  id: number;
  centerId: number;
  memberId: number;
  source: DebtSource;
  referenceType: string | null;
  referenceId: number | null;
  title: string;
  note: string | null;
  originalAmountCents: number;
  paidAmountCents: number;
  remainingAmountCents: number;
  status: DebtStatus;
  localDate: string;
  createdBy: number;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DebtCreationAttributes
  extends Optional<
    DebtAttributes,
    | "id"
    | "referenceType"
    | "referenceId"
    | "note"
    | "paidAmountCents"
    | "remainingAmountCents"
    | "status"
    | "version"
    | "createdAt"
    | "updatedAt"
  > {}

class Debt
  extends Model<DebtAttributes, DebtCreationAttributes>
  implements DebtAttributes
{
  public id!: number;
  public centerId!: number;
  public memberId!: number;
  public source!: DebtSource;
  public referenceType!: string | null;
  public referenceId!: number | null;
  public title!: string;
  public note!: string | null;
  public originalAmountCents!: number;
  public paidAmountCents!: number;
  public remainingAmountCents!: number;
  public status!: DebtStatus;
  public localDate!: string;
  public createdBy!: number;
  public version!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default Debt;
