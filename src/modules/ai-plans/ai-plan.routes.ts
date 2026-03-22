import { Router } from "express";
import { allowRoles, protect, validate } from "../../shared";
import * as aiPlanController from "./ai-plan.controller";
import { AiPlanValidation } from "./ai-plan.schema";

const router = Router();

router.use(protect);
router.use(allowRoles("owner", "manager"));

router.post(
  "/generate",
  validate(AiPlanValidation.generate),
  aiPlanController.generatePlan,
);
router.get(
  "/:id",
  validate(AiPlanValidation.getById),
  aiPlanController.getPlanById,
);
router.get(
  "/member/:memberId",
  validate(AiPlanValidation.listByMember),
  aiPlanController.listMemberPlans,
);
router.patch(
  "/:id",
  validate(AiPlanValidation.update),
  aiPlanController.updatePlan,
);
router.post(
  "/:id/approve",
  validate(AiPlanValidation.approve),
  aiPlanController.approvePlan,
);
router.post(
  "/:id/reject",
  validate(AiPlanValidation.reject),
  aiPlanController.rejectPlan,
);
router.post(
  "/:id/pdf",
  validate(AiPlanValidation.generatePdf),
  aiPlanController.generatePdf,
);
router.get(
  "/:id/pdf",
  validate(AiPlanValidation.downloadPdf),
  aiPlanController.downloadPdf,
);
router.post(
  "/:id/send-whatsapp",
  validate(AiPlanValidation.sendWhatsApp),
  aiPlanController.sendPlanOnWhatsApp,
);

export default router;
