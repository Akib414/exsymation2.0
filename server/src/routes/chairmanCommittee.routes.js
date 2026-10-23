import { Router } from "express";

import {
  listChairmanCommittees,
  getChairmanCommittee,
  listEligibleTeachers,
  createChairmanCommittee,
} from "../controllers/chairmanCommittee.controller.js";
import {
  protectTeacher,
  requirePasswordChanged,
  requireChairmanStrict,
} from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { createChairmanCommitteeSchema } from "../validators/chairmanCommittee.validator.js";

const router = Router();

// Chairman-only module. requireChairmanStrict re-checks the DB every request.
router.use(protectTeacher, requirePasswordChanged, requireChairmanStrict);

router.get("/eligible-teachers", listEligibleTeachers);
router.post("/", validate(createChairmanCommitteeSchema), createChairmanCommittee);
router.get("/", listChairmanCommittees);
router.get("/:id", getChairmanCommittee);

export default router;
