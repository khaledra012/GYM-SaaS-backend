import { Router } from "express";
import { protect, validate } from "../../shared";
import * as accountingController from "./accounting.controller";
import { AccountingValidation } from "./accounting.schema";

const router = Router();

router.use(protect);

router.post(
  "/shifts/open",
  validate(AccountingValidation.openShift),
  accountingController.openShift,
);

router.post(
  "/shifts/close",
  validate(AccountingValidation.closeShift),
  accountingController.closeShift,
);

router.get(
  "/shifts",
  validate(AccountingValidation.listShifts),
  accountingController.getShifts,
);

router.get("/shifts/current", accountingController.getCurrentShift);

router.post(
  "/transactions",
  validate(AccountingValidation.createTransaction),
  accountingController.createManualTransaction,
);

router.get(
  "/transactions",
  validate(AccountingValidation.listTransactions),
  accountingController.getTransactionsLedger,
);

router.get(
  "/dashboard/summary",
  validate(AccountingValidation.dashboardSummary),
  accountingController.getDashboardSummary,
);

export default router;

