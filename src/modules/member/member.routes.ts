import { Router } from "express";
import { protect, validate } from "../../shared";
import * as memberController from "./member.controller";
import { MemberValidation } from "./member.schema";

const router = Router();

router.use(protect);

router.get("/stats", memberController.getStats);

router
  .route("/")
  .get(validate(MemberValidation.getAllMembers), memberController.getAllMembers)
  .post(validate(MemberValidation.createMember), memberController.createMember);

router.get(
  "/:id/barcode.svg",
  validate(MemberValidation.memberId),
  memberController.getMemberBarcodeSvg,
);

router
  .route("/:id")
  .get(validate(MemberValidation.memberId), memberController.getMemberById)
  .patch(validate(MemberValidation.updateMember), memberController.updateMember)
  .delete(validate(MemberValidation.memberId), memberController.deleteMember);

export default router;
