import mongoose from "mongoose";

// Per account+IP failure tracking. Account-wide Teacher/Admin lock remains as fallback.
const loginAttemptSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    identifier: { type: String, required: true, lowercase: true, trim: true, index: true },
    ip: { type: String, required: true, maxlength: 64 },
    attempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("LoginAttempt", loginAttemptSchema);
