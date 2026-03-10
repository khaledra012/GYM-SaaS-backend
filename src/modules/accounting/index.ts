import { Application } from "express";
import accountingRoutes from "./accounting.routes";

export const registerAccountingModule = (app: Application) => {
  app.use("/api/v1/accounting", accountingRoutes);
};

export { accountingFacade } from "./accounting.facade";
export type {
  IRecordAutomatedIncomeInput,
  IReverseAutomatedTransactionInput,
  IReverseByReferenceInput,
} from "./accounting.facade";
