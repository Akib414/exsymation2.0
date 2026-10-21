import { Router } from "express";

import {
  listTeachers,
  getTeacherDetail,
  listBatches,
  getBatchDetail,
} from "../controllers/chairman.controller.js";
import {
  protectTeacher,
  requireChairmanStrict,
  requirePasswordChanged,
} from "../middlewares/auth.middleware.js";

const router = Router();

// Chairman-only module. requireChairmanStrict re-checks the DB every request.
router.use(protectTeacher, requirePasswordChanged, requireChairmanStrict);

// Teacher oversight.
router.get("/teachers", listTeachers);
router.get("/teachers/:id", getTeacherDetail);

// Batch monitoring.
router.get("/batches", listBatches);
router.get("/batches/:id", getBatchDetail);

export default router;
