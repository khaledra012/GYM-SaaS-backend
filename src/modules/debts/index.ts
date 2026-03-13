import { Application } from "express";
import debtRoutes from "./debt.routes";

export const registerDebtModule = (app: Application) => {
  app.use("/api/v1/debts", debtRoutes);
};

export { debtCommandFacade, debtReadFacade } from "./debt.facade";
export type {
  ICreateAutomatedDebtInput,
  ISettleOutstandingDebtsByAdjustmentInput,
} from "./debt.facade";
