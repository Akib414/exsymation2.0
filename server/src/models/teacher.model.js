import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: { type: String, trim: true, maxlength: 20 },
    // Encrypted with src/utils/crypto.util.js (AES-256-GCM). Never query by plain value.
    nid: { type: String, select: false },
    photo: { type: String, trim: true, maxlength: 1024 },
    passwordHash: { type: String, required: true, select: false },
    // Approved: keep status enum, NO isActive field.
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    mustChangePassword: { type: Boolean, default: true },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Teacher", teacherSchema);
