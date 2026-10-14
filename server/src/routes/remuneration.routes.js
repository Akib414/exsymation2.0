import { Router } from "express";

import { protectTeacher, requirePasswordChanged } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(protectTeacher, requirePasswordChanged);

router.get("/", (req, res) =>
  res.status(501).json({ success: false, message: "Remuneration routes not implemented yet" })
);

export default router;
