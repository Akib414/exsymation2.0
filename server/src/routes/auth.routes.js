import { Router } from "express";

import {
  login,
  refresh,
  logout,
  logoutAll,
  changePassword,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { protectTeacher } from "../middlewares/auth.middleware.js";
import { csrfCheck } from "../middlewares/csrf.middleware.js";
import {
  loginLimiter,
  authLimiter,
  refreshLimiter,
} from "../middlewares/rateLimiter.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/refresh", refreshLimiter, csrfCheck, refresh);
router.delete("/refresh", csrfCheck, logout);
router.post("/logout", csrfCheck, logout);
router.post("/logout-all", protectTeacher, logoutAll);
router.post("/change-password", protectTeacher, validate(changePasswordSchema), changePassword);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
