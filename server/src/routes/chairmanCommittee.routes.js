import { Router } from "express";

import {
  listChairmanCommittees,
  getChairmanCommittee,
} from "../controllers/chairmanCommittee.controller.js";
import {
  protectTeacher,
  requirePasswordChanged,
  requireChairmanStrict,
} from "../middlewares/auth.middleware.js";

const router = Router();

// Chairman-only module. requireChairmanStrict re-checks the DB every request.
router.use(protectTeacher, requirePasswordChanged, requireChairmanStrict);

router.get("/", listChairmanCommittees);
router.get("/:id", getChairmanCommittee);

export default router;
