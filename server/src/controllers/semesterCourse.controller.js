import mongoose from "mongoose";

import Course from "../models/course.model.js";
import SemesterCourse from "../models/semesterCourse.model.js";
import { writeAudit } from "../utils/audit.js";

function toCourseOut(d) {
  return {
    id: String(d._id),
    course_code: d.course_code,
    course_name: d.course_name,
    course_type: d.course_type,
    course_credit: d.course_credit,
  };
}

// POST /api/admin/semester-courses/courses — admin only.
// Body: { semester: 1-10, courseId? | course_code? }. Creates semester doc if missing.
async function addCourseToSemester(req, res, next) {
  try {
    const { semester, courseId, course_code } = req.body;

    const course = courseId
      ? await Course.findById(courseId).select("_id").lean()
      : await Course.findOne({ course_code }).select("_id").lean();
    if (!course) {
      const err = new Error("Course not found");
      err.status = 404;
      return next(err);
    }

    // One course lives in exactly one semester — refuse if attached elsewhere.
    const clash = await SemesterCourse.findOne({
      semester: { $ne: semester },
      course_list: course._id,
    })
      .select("semester")
      .lean();
    if (clash) {
      const err = new Error(`Course is already in semester ${clash.semester}`);
      err.status = 409;
      return next(err);
    }

    const doc = await SemesterCourse.findOneAndUpdate(
      { semester },
      { $addToSet: { course_list: course._id } },
      { new: true, upsert: true, runValidators: true }
    ).populate("course_list", "course_code course_name course_type course_credit");

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: "semester-course.add",
      entity: "SemesterCourse",
      entityId: doc._id,
      meta: { semester, courseId: String(course._id) },
    });

    return res.status(201).json({
      semester: doc.semester,
      count: doc.course_list.length,
      courses: doc.course_list.map(toCourseOut),
    });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/admin/semester-courses/:semester/courses/:courseId — admin only.
async function removeCourseFromSemester(req, res, next) {
  try {
    const semester = Number(req.params.semester);
    const { courseId } = req.params;
    if (!Number.isInteger(semester) || semester < 1 || semester > 10) {
      const err = new Error("Invalid semester");
      err.status = 400;
      return next(err);
    }
    if (!mongoose.isValidObjectId(courseId)) {
      const err = new Error("Invalid course id");
      err.status = 400;
      return next(err);
    }

    const doc = await SemesterCourse.findOne({ semester });
    if (!doc) {
      const err = new Error("Semester not found");
      err.status = 404;
      return next(err);
    }
    const before = doc.course_list.length;
    doc.course_list = doc.course_list.filter((c) => String(c) !== String(courseId));
    if (doc.course_list.length === before) {
      const err = new Error("Course not in semester list");
      err.status = 404;
      return next(err);
    }
    await doc.save();
    await doc.populate("course_list", "course_code course_name course_type course_credit");

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: "semester-course.remove",
      entity: "SemesterCourse",
      entityId: doc._id,
      meta: { semester, courseId },
    });

    return res.json({
      semester: doc.semester,
      count: doc.course_list.length,
      courses: doc.course_list.map(toCourseOut),
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/semester-courses/:semester — admin only.
async function getSemesterCourses(req, res, next) {
  try {
    const semester = Number(req.params.semester);
    const doc = await SemesterCourse.findOne({ semester }).populate(
      "course_list",
      "course_code course_name course_type course_credit"
    );
    if (!doc) return res.json({ semester, count: 0, courses: [] });
    return res.json({
      semester: doc.semester,
      count: doc.course_list.length,
      courses: doc.course_list.map(toCourseOut),
    });
  } catch (err) {
    return next(err);
  }
}

export { addCourseToSemester, removeCourseFromSemester, getSemesterCourses };
