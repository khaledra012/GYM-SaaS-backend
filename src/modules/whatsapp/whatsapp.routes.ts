import { Router } from "express";
import { allowRoles, protect, validate } from "../../shared";
import * as whatsAppController from "./whatsapp.controller";
import { WhatsAppValidation } from "./whatsapp.schema";

const router = Router();

router.use(protect);
router.use(allowRoles("owner", "manager"));

router.post(
  "/session/connect",
  validate(WhatsAppValidation.connectSession),
  whatsAppController.connectSession,
);
router.get(
  "/session/status",
  validate(WhatsAppValidation.getSessionStatus),
  whatsAppController.getSessionStatus,
);
router.post(
  "/session/disconnect",
  validate(WhatsAppValidation.disconnectSession),
  whatsAppController.disconnectSession,
);
router.post(
  "/session/resume",
  validate(WhatsAppValidation.resumeModule),
  whatsAppController.resumeModule,
);

router.post(
  "/messages/test",
  validate(WhatsAppValidation.sendTestMessage),
  whatsAppController.sendTestMessage,
);
router.get(
  "/messages",
  validate(WhatsAppValidation.listMessages),
  whatsAppController.listMessages,
);

router.get(
  "/templates",
  validate(WhatsAppValidation.listTemplates),
  whatsAppController.listTemplates,
);
router.post(
  "/templates",
  validate(WhatsAppValidation.createTemplate),
  whatsAppController.createTemplate,
);
router.patch(
  "/templates/:id",
  validate(WhatsAppValidation.updateTemplate),
  whatsAppController.updateTemplate,
);

router.get(
  "/opt-ins/:memberId",
  validate(WhatsAppValidation.getMemberOptIn),
  whatsAppController.getMemberOptIn,
);
router.put(
  "/opt-ins/:memberId",
  validate(WhatsAppValidation.updateMemberOptIn),
  whatsAppController.updateMemberOptIn,
);

router.post(
  "/campaigns/preview",
  validate(WhatsAppValidation.previewCampaign),
  whatsAppController.previewCampaign,
);
router.post(
  "/campaigns",
  validate(WhatsAppValidation.createCampaign),
  whatsAppController.createCampaign,
);
router.get(
  "/campaigns",
  validate(WhatsAppValidation.listCampaigns),
  whatsAppController.listCampaigns,
);
router.get(
  "/campaigns/:id",
  validate(WhatsAppValidation.getCampaignById),
  whatsAppController.getCampaignById,
);
router.post(
  "/campaigns/:id/pause",
  validate(WhatsAppValidation.pauseCampaign),
  whatsAppController.pauseCampaign,
);
router.post(
  "/campaigns/:id/resume",
  validate(WhatsAppValidation.resumeCampaign),
  whatsAppController.resumeCampaign,
);
router.post(
  "/campaigns/:id/cancel",
  validate(WhatsAppValidation.cancelCampaign),
  whatsAppController.cancelCampaign,
);

export default router;
