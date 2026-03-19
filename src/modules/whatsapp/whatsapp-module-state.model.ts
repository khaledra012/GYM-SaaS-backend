import { Model, Optional } from "sequelize";
import { WhatsAppModuleStatus } from "./whatsapp.types";

export interface WhatsAppModuleStateAttributes {
  id: number;
  scopeKey: string;
  status: WhatsAppModuleStatus;
  reason: string | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  failureRate: number | null;
  attemptsCount: number | null;
  evaluatedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WhatsAppModuleStateCreationAttributes
  extends Optional<
    WhatsAppModuleStateAttributes,
    | "id"
    | "reason"
    | "pausedAt"
    | "resumedAt"
    | "failureRate"
    | "attemptsCount"
    | "evaluatedAt"
    | "createdAt"
    | "updatedAt"
  > {}

class WhatsAppModuleState
  extends Model<
    WhatsAppModuleStateAttributes,
    WhatsAppModuleStateCreationAttributes
  >
  implements WhatsAppModuleStateAttributes
{
  public id!: number;
  public scopeKey!: string;
  public status!: WhatsAppModuleStatus;
  public reason!: string | null;
  public pausedAt!: Date | null;
  public resumedAt!: Date | null;
  public failureRate!: number | null;
  public attemptsCount!: number | null;
  public evaluatedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default WhatsAppModuleState;
