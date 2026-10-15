import { Router } from "express";

import {
  createCommittee,
  listCommittees,
} from "../controllers/committee.controller.js";
import {
  protectTeacher,
  requireChairmanStrict,
  requirePasswordChanged,
} from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { committeeCreateSchema } from "../validators/committee.validator.js";

const router = Router();

// Deny by default once mustChangePassword.
router.use(protectTeacher, requirePasswordChanged);

// POST /exam-committee — chairman only, verified against DB (token may be stale).
router.post("/", requireChairmanStrict, validate(committeeCreateSchema), createCommittee);
router.get("/", listCommittees);

// Chairman handover moved to admin-only: POST /api/admin/chairmen/change.

export default router;
