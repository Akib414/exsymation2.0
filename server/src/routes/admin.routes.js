import { Router } from "express";

import { login, refresh, logout, logoutAll } from "../controllers/admin.controller.js";
import { protectAdmin } from "../middlewares/auth.middleware.js";
import { csrfCheck } from "../middlewares/csrf.middleware.js";
import { loginLimiter, refreshLimiter } from "../middlewares/rateLimiter.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { adminLoginSchema } from "../validators/auth.validator.js";

const router = Router();

// Admin-only login — no signup route. Credentials are seeded via scripts/seed-admin.js.
router.post("/login", loginLimiter, validate(adminLoginSchema), login);
router.post("/refresh", refreshLimiter, csrfCheck, refresh);
router.delete("/refresh", csrfCheck, logout);
router.post("/logout", csrfCheck, logout);
router.post("/logout-all", protectAdmin, logoutAll);

export default router;
