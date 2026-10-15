import mongoose from "mongoose";

import Course from "../models/course.model.js";
import SemesterCourse from "../models/semesterCourse.model.js";
import CourseAssignment from "../models/courseAssignment.model.js";
import { writeAudit } from "../utils/audit.js";
import { cleanObject } from "../utils/sanitize.js";

// POST /api/admin/courses — admin only. Single object OR { courses: [...] }.
async function createCourses(req, res, next) {
  try {
    const items = Array.isArray(req.body.courses) ? req.body.courses : [req.body];
    const isBulk = Array.isArray(req.body.courses);
    const cleaned = items.map((c) => cleanObject(c));

    const codes = cleaned.map((c) => String(c.course_code).trim());
    if (new Set(codes).size !== codes.length) {
      const err = new Error("Duplicate course_code in request");
      err.status = 409;
      return next(err);
    }

    const existing = await Course.find({ course_code: { $in: codes } })
      .select("course_code")
      .lean();
    if (existing.length > 0) {
      const err = new Error(
        `Course code already exists: ${existing.map((e) => e.course_code).join(", ")}`
      );
      err.status = 409;
      return next(err);
    }

    const docs = await Course.insertMany(cleaned, { ordered: true });

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: isBulk ? "course.bulk-create" : "course.create",
      entity: "Course",
      meta: { count: docs.length, codes },
    });

    if (!isBulk) {
      const d = docs[0];
      return res.status(201).json({
        id: String(d._id),
        course_code: d.course_code,
        course_name: d.course_name,
        course_type: d.course_type,
        course_credit: d.course_credit,
      });
    }

    return res.status(201).json({
      count: docs.length,
      courses: docs.map((d) => ({
        id: String(d._id),
        course_code: d.course_code,
        course_name: d.course_name,
        course_type: d.course_type,
        course_credit: d.course_credit,
      })),
    });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate course code";
    }
    return next(err);
  }
}

// GET /api/admin/courses — admin only. List all courses.
async function listCourses(req, res, next) {
  try {
    const docs = await Course.find({}).sort({ course_code: 1 }).lean();
    return res.json({
      count: docs.length,
      courses: docs.map((d) => ({
        id: String(d._id),
        course_code: d.course_code,
        course_name: d.course_name,
        course_type: d.course_type,
        course_credit: d.course_credit,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/admin/courses/:id — admin only. Partial update.
async function updateCourse(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }
    const cleaned = cleanObject(req.body);
    if (cleaned.course_code) {
      const clash = await Course.findOne({
        _id: { $ne: id },
        course_code: cleaned.course_code,
      })
        .select("_id")
        .lean();
      if (clash) {
        const err = new Error("Course code already exists");
        err.status = 409;
        return next(err);
      }
    }
    const doc = await Course.findByIdAndUpdate(id, { $set: cleaned }, { new: true, runValidators: true });
    if (!doc) {
      const err = new Error("Not found");
      err.status = 404;
      return next(err);
    }
    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: "course.update",
      entity: "Course",
      entityId: doc._id,
      meta: { updated: Object.keys(cleaned) },
    });
    return res.json({
      id: String(doc._id),
      course_code: doc.course_code,
      course_name: doc.course_name,
      course_type: doc.course_type,
      course_credit: doc.course_credit,
    });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate course code";
    }
    return next(err);
  }
}

// DELETE /api/admin/courses/:id — admin only. Blocked if referenced.
async function deleteCourse(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }
    const doc = await Course.findById(id).select("_id course_code").lean();
    if (!doc) {
      const err = new Error("Not found");
      err.status = 404;
      return next(err);
    }
    const [inSemester, inAssignment] = await Promise.all([
      SemesterCourse.countDocuments({ course_list: doc._id }),
      CourseAssignment.countDocuments({ course: doc._id }),
    ]);
    if (inSemester > 0 || inAssignment > 0) {
      const err = new Error("Course is referenced — cannot delete");
      err.status = 409;
      return next(err);
    }
    await Course.deleteOne({ _id: doc._id });
    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: "course.delete",
      entity: "Course",
      entityId: doc._id,
      meta: { course_code: doc.course_code },
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export { createCourses, listCourses, updateCourse, deleteCourse };
