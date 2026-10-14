import mongoose from "mongoose";

const courseAssignmentSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    semester: { type: Number, required: true, min: 1, max: 10 },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    firstExaminers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true }],
    secondExaminer: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
    thirdExaminer: {
      teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true },
      studentCount: { type: Number, min: 0 },
    },
  },
  { timestamps: true }
);

courseAssignmentSchema.index({ session: 1, semester: 1, course: 1 }, { unique: true });

// Third examiner must differ from first and second examiners of the same course.
courseAssignmentSchema.pre("validate", function validateThird(next) {
  const third = this.thirdExaminer?.teacher;
  if (!third) return next();
  const thirdStr = String(third);
  const firstStrs = (this.firstExaminers || []).map(String);
  if (firstStrs.includes(thirdStr) || String(this.secondExaminer) === thirdStr) {
    return next(
      new Error("thirdExaminer.teacher must differ from first and second examiners")
    );
  }
  return next();
});

export default mongoose.model("CourseAssignment", courseAssignmentSchema);
