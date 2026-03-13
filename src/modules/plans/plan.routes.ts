import { Router } from "express";
import * as planController from "./plan.controller";
import { validate, protect } from "../../shared";
import { PlanValidation } from "./plan.schema";

const router = Router();

router.use(protect);

router.get("/", planController.getAllPlans);
router.post(
  "/",
  validate(PlanValidation.createPlan),
  planController.createPlan,
);

router.patch(
  "/:id",
  validate(PlanValidation.updatePlan),
  planController.updatePlan,
);

router.get(
  "/:id",
  validate(PlanValidation.planId),
  planController.getPlanById,
);

router.delete(
  "/:id",
  validate(PlanValidation.planId),
  planController.deletePlan,
);

export default router;
