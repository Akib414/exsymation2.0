import mongoose from "mongoose";

const externalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    institution: { type: String, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 20 },
  },
  { _id: false }
);

const examCommitteeSchema = new mongoose.Schema(
  {
    chairman: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    member1: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    member2: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    tabulator1: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
    tabulator2: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
    // EXTERNAL MEMBER IS NOT AN ACCOUNT — embedded plain data, never checked by getRoles.
    external: { type: externalSchema, default: null },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    semester: { type: Number, required: true, min: 1, max: 10 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  },
  { timestamps: true }
);

examCommitteeSchema.index({ session: 1, semester: 1, status: 1 });
examCommitteeSchema.index({ start: 1, end: 1 });

export default mongoose.model("ExamCommittee", examCommitteeSchema);
