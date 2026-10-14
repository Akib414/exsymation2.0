import { Router } from "express";

import {
  me,
  getTeacherById,
  requestEmailChange,
  confirmEmailChange,
  duties,
  assignments,
} from "../controllers/me.controller.js";
import { protectTeacher, requirePasswordChanged } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { emailRequestSchema, emailConfirmSchema } from "../validators/auth.validator.js";

const router = Router();

// Allow-list: GET /me stays available during mustChangePassword so the client can prompt.
// Everything else below denies by default until the password is changed.
router.get("/", protectTeacher, me);

router.use(protectTeacher, requirePasswordChanged);

router.post("/email/request", validate(emailRequestSchema), requestEmailChange);
router.post("/email/confirm", validate(emailConfirmSchema), confirmEmailChange);
router.get("/duties", duties);
router.get("/assignments", assignments);
// Owner or chairman only (handler enforces). Placed after /duties etc. to avoid param clash.
router.get("/:id", getTeacherById);

export default router;
