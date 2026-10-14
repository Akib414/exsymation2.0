import mongoose from "mongoose";

const routineSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    semester: { type: Number, required: true, min: 1, max: 10 },
    date: { type: Date, required: true },
    time: { type: String, required: true, trim: true, maxlength: 16 },
    // Renamed from inv_list. Used by getRoles(invigilator).
    invigilators: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teacher", index: true }],
    // Renamed from course_id.
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  },
  { timestamps: true }
);

routineSchema.index({ session: 1, semester: 1, date: 1 });

export default mongoose.model("Routine", routineSchema);
