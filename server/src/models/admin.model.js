import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 64,
    },
    passwordHash: { type: String, required: true, select: false },
    // Empty for now — permission enforcement comes later.
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);
