import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("PasswordReset", passwordResetSchema);
