import mongoose from "mongoose";

// One claim per teacher. The unique index on `teacher` is the database-level
// lock that stops two concurrent committee creations from reserving the same
// teacher: a transaction would need a replica set, an index does not.
const teacherCommitteeClaimSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      unique: true,
      index: true,
    },
    committee: { type: mongoose.Schema.Types.ObjectId, ref: "ExamCommittee", default: null },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    semester: { type: Number, required: true, min: 1, max: 10 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("TeacherCommitteeClaim", teacherCommitteeClaimSchema);
