import { Router } from "express";

const router = Router();

// TODO: Implement login, refresh-token rotation, logout, and /me.
// Privileged accounts should be provisioned by an authorized administrator, not public signup.
router.post("/login", (req, res) =>
  res.status(501).json({ success: false, message: "Login endpoint not implemented yet" })
);

export default router;
