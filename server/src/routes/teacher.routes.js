import { Router } from "express";

const router = Router();

router.get("/", (req, res) =>
  res.status(501).json({ success: false, message: "Teacher routes not implemented yet" })
);

export default router;
