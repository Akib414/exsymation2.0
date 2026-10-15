import { Router } from "express";

import { getTeacherById } from "../controllers/me.controller.js";
import { protectTeacher, requirePasswordChanged } from "../middlewares/auth.middleware.js";

const router = Router();

// Deny by default once mustChangePassword — chairman routes are all guarded.
router.use(protectTeacher, requirePasswordChanged);

// Chairman-only management moved to admin-only routes — see admin.routes.js.
// Never hard-delete — deactivate only via admin.


router.get("/:id", getTeacherById);

export default router;
