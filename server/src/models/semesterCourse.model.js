import mongoose from "mongoose";

const semesterCourseSchema = new mongoose.Schema(
  {
    semester: { type: Number, required: true, min: 1, max: 10 },
    // Approved: only convert to ObjectId refs, do NOT add session.
    course_list: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true }],
  },
  { timestamps: true }
);

semesterCourseSchema.index({ semester: 1 });

export default mongoose.model("SemesterCourse", semesterCourseSchema);
