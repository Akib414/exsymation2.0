import mongoose from "mongoose";

const emailChangeRequestSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    newEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("EmailChangeRequest", emailChangeRequestSchema);
