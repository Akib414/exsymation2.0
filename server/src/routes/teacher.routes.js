import { Router } from "express";

import {
  createTeacher,
  deactivateTeacher,
  reactivateTeacher,
  resetTeacherPassword,
} from "../controllers/teacher.controller.js";
import { getTeacherById } from "../controllers/me.controller.js";
import {
  protectTeacher,
  requireChairmanStrict,
  requirePasswordChanged,
} from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { teacherCreateSchema } from "../validators/committee.validator.js";

const router = Router();

// Deny by default once mustChangePassword — chairman routes are all guarded.
router.use(protectTeacher, requirePasswordChanged);

// Chairman-only management. Never hard-delete — deactivate only.
router.post("/", requireChairmanStrict, validate(teacherCreateSchema), createTeacher);
router.patch("/:id/deactivate", requireChairmanStrict, deactivateTeacher);
router.patch("/:id/reactivate", requireChairmanStrict, reactivateTeacher);
router.post("/:id/reset-password", requireChairmanStrict, resetTeacherPassword);
router.get("/:id", getTeacherById);

export default router;
