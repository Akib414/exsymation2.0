import { Router } from "express";

import {
  createCommittee,
  listCommittees,
  getCommittee,
  updateCommittee,
  deactivateCommittee,
} from "../controllers/committee.controller.js";
import {
  protectTeacher,
  requireChairmanStrict,
  requirePasswordChanged,
} from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { committeeCreateSchema, committeeUpdateSchema } from "../validators/committee.validator.js";

const router = Router();

// Deny by default once mustChangePassword.
router.use(protectTeacher, requirePasswordChanged);

// POST /exam-committee — chairman only, verified against DB (token may be stale).
router.post("/", requireChairmanStrict, validate(committeeCreateSchema), createCommittee);
router.get("/", listCommittees);
router.get("/:id", getCommittee);

// Committee administration — chairman only, verified against DB.
router.patch("/:id", requireChairmanStrict, validate(committeeUpdateSchema), updateCommittee);
router.delete("/:id", requireChairmanStrict, deactivateCommittee);

// Chairman handover moved to admin-only: POST /api/admin/chairmen/change.

export default router;
