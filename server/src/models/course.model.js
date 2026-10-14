import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    course_code: { type: String, required: true, unique: true, trim: true, maxlength: 32 },
    course_name: { type: String, required: true, trim: true, maxlength: 200 },
    course_type: { type: String, enum: ["Theory", "Lab"], required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Course", courseSchema);
