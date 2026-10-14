import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    session: { type: String, required: true, trim: true, maxlength: 32 },
    batch: { type: String, trim: true, maxlength: 32 },
    current_semester: { type: Number, min: 1, max: 10 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);

sessionSchema.index({ session: 1 });

export default mongoose.model("Session", sessionSchema);
