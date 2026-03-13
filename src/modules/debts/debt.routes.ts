import { Router } from "express";
import { protect, validate } from "../../shared";
import * as debtController from "./debt.controller";
import { DebtValidation } from "./debt.schema";

const router = Router();

router.use(protect);

router.get("/summary", validate(DebtValidation.summary), debtController.getSummary);

router.get(
  "/member/:memberId/summary",
  validate(DebtValidation.memberSummary),
  debtController.getMemberSummary,
);

router.get(
  "/member/:memberId",
  validate(DebtValidation.memberDebts),
  debtController.listMemberDebts,
);

router.get("/", validate(DebtValidation.listDebts), debtController.listDebts);

router.post("/", validate(DebtValidation.createDebt), debtController.createDebt);

router.get("/:id", validate(DebtValidation.debtId), debtController.getDebtById);

router.post(
  "/:id/payments",
  validate(DebtValidation.createPayment),
  debtController.createDebtPayment,
);

export default router;
