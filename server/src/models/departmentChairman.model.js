import mongoose from "mongoose";

const departmentChairmanSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// ONLY ONE ACTIVE CHAIRMAN.
departmentChairmanSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

export default mongoose.model("DepartmentChairman", departmentChairmanSchema);
