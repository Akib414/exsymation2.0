import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    session: { type: String, required: true, trim: true, maxlength: 32 },
    batch: { type: String, required: true, trim: true, maxlength: 32 },
    current_semester: { type: Number, min: 1, max: 10, default: 1 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    student_number: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

sessionSchema.index({ session: 1 });

sessionSchema.index({ session: 1, batch: 1 }, { unique: true });

export default mongoose.model("Session", sessionSchema);
