import mongoose from "mongoose";

import Teacher from "../models/teacher.model.js";
import Session from "../models/session.model.js";
import DepartmentChairman from "../models/departmentChairman.model.js";
import ExamCommittee from "../models/examCommittee.model.js";
import CourseAssignment from "../models/courseAssignment.model.js";
import Routine from "../models/routine.model.js";
import SemesterCourse from "../models/semesterCourse.model.js";
import { getRoles } from "../services/roles.service.js";
import { startOfDayInTZ } from "../utils/timezone.js";

const COMMITTEE_SLOTS = ["chairman", "member1", "member2", "tabulator1", "tabulator2"];

function invalidId(message = "Invalid id") {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message = "Not found") {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bump(map, key) {
  if (!key) return;
  const id = String(key);
  map.set(id, (map.get(id) || 0) + 1);
}

function mapFromRows(rows) {
  const map = new Map();
  for (const row of rows) map.set(String(row._id), row.count);
  return map;
}

function activeSessionIds() {
  return Session.find({ status: "active" }).select("_id").lean();
}

function teacherIdOf(value) {
  if (!value) return null;
  return String(value._id || value);
}

// GET /api/chairman/teachers — chairman-only directory with derived activity counts.
async function listTeachers(req, res, next) {
  try {
    const filter = {};
    if (req.query.status === "active" || req.query.status === "inactive") {
      filter.status = req.query.status;
    }
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 100)), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const now = new Date();
    const startOfToday = startOfDayInTZ(now);

    const [teachers, activeChair, activeCommittees, sessions] = await Promise.all([
      Teacher.find(filter)
        .sort({ name: 1 })
        .select("name email phone photo status mustChangePassword createdAt")
        .lean(),
      DepartmentChairman.findOne({ status: "active" }).select("teacher").lean(),
      ExamCommittee.find({
        status: "active",
        start: { $lte: now },
        end: { $gte: startOfToday },
      })
        .select("chairman member1 member2 tabulator1 tabulator2")
        .lean(),
      activeSessionIds(),
    ]);

    const ids = teachers.map((t) => t._id);
    const sessionIds = sessions.map((s) => s._id);

    const [examinerRows, dutyRows] = await Promise.all([
      sessionIds.length && ids.length
        ? CourseAssignment.aggregate([
            { $match: { session: { $in: sessionIds } } },
            {
              $project: {
                teachers: {
                  $concatArrays: [
                    { $ifNull: ["$firstExaminers", []] },
                    {
                      $cond: [
                        { $ifNull: ["$secondExaminer", false] },
                        ["$secondExaminer"],
                        [],
                      ],
                    },
                    {
                      $cond: [
                        { $ifNull: ["$thirdExaminer.teacher", false] },
                        ["$thirdExaminer.teacher"],
                        [],
                      ],
                    },
                  ],
                },
              },
            },
            { $unwind: "$teachers" },
            { $group: { _id: "$teachers", count: { $sum: 1 } } },
          ])
        : [],
      sessionIds.length && ids.length
        ? Routine.aggregate([
            { $match: { session: { $in: sessionIds }, invigilators: { $in: ids } } },
            { $unwind: "$invigilators" },
            { $match: { invigilators: { $in: ids } } },
            { $group: { _id: "$invigilators", count: { $sum: 1 } } },
          ])
        : [],
    ]);

    const committeeCounts = new Map();
    for (const committee of activeCommittees) {
      for (const slot of COMMITTEE_SLOTS) {
        bump(committeeCounts, committee[slot]);
      }
    }
    const assignmentCounts = mapFromRows(examinerRows);
    const dutyCounts = mapFromRows(dutyRows);
    const chairId = teacherIdOf(activeChair?.teacher);

    return res.json({
      count: teachers.length,
      teachers: teachers.map((t) => {
        const id = String(t._id);
        return {
          id,
          name: t.name,
          email: t.email,
          phone: t.phone,
          photo: t.photo || null,
          status: t.status,
          mustChangePassword: t.mustChangePassword,
          isChairman: chairId === id,
          activeCommittee: (committeeCounts.get(id) || 0) > 0,
          committeeCount: committeeCounts.get(id) || 0,
          assignmentCount: assignmentCounts.get(id) || 0,
          invigilationCount: dutyCounts.get(id) || 0,
          createdAt: t.createdAt,
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/chairman/teachers/:id — academic profile, roles, duties, assignments.
async function getTeacherDetail(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(invalidId());

    const tid = new mongoose.Types.ObjectId(id);
    const teacher = await Teacher.findById(tid)
      .select("name email phone photo status mustChangePassword createdAt")
      .lean();
    if (!teacher) return next(notFound("Teacher not found"));

    const committeeMatch = { $or: COMMITTEE_SLOTS.map((slot) => ({ [slot]: tid })) };

    const [roles, chairmanTerms, committees, assignments, duties] = await Promise.all([
      getRoles(tid),
      DepartmentChairman.find({ teacher: tid }).sort({ startDate: -1 }).lean(),
      ExamCommittee.find(committeeMatch)
        .sort({ start: -1 })
        .populate("session", "session batch")
        .lean(),
      CourseAssignment.find({
        $or: [
          { firstExaminers: tid },
          { secondExaminer: tid },
          { "thirdExaminer.teacher": tid },
        ],
      })
        .sort({ createdAt: -1 })
        .populate("course", "course_code course_name course_type course_credit")
        .populate("session", "session batch")
        .lean(),
      Routine.find({ invigilators: tid })
        .sort({ date: 1 })
        .populate("course", "course_code course_name")
        .populate("session", "session batch")
        .lean(),
    ]);

    return res.json({
      data: {
        teacher: {
          id: String(teacher._id),
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          photo: teacher.photo || null,
          status: teacher.status,
          mustChangePassword: teacher.mustChangePassword,
          createdAt: teacher.createdAt,
        },
        roles,
        chairmanTerms: chairmanTerms.map((term) => ({
          id: String(term._id),
          status: term.status,
          startDate: term.startDate,
          endDate: term.endDate,
        })),
        committees,
        assignments,
        duties,
      },
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/chairman/batches — running batches with activity counts.
async function listBatches(req, res, next) {
  try {
    const now = new Date();
    const startOfToday = startOfDayInTZ(now);

    const batches = await Session.find({}).sort({ session: -1, batch: 1 }).lean();
    const ids = batches.map((b) => b._id);

    const [assignmentRows, routineRows, committeeRows, activeCommittees] = await Promise.all([
      ids.length
        ? CourseAssignment.aggregate([
            { $match: { session: { $in: ids } } },
            { $group: { _id: "$session", count: { $sum: 1 } } },
          ])
        : [],
      ids.length
        ? Routine.aggregate([
            { $match: { session: { $in: ids } } },
            { $group: { _id: "$session", count: { $sum: 1 } } },
          ])
        : [],
      ids.length
        ? ExamCommittee.aggregate([
            { $match: { session: { $in: ids } } },
            { $group: { _id: "$session", count: { $sum: 1 } } },
          ])
        : [],
      ids.length
        ? ExamCommittee.find({
            session: { $in: ids },
            status: "active",
            start: { $lte: now },
            end: { $gte: startOfToday },
          })
            .select("session semester")
            .lean()
        : [],
    ]);

    const assignmentCounts = mapFromRows(assignmentRows);
    const routineCounts = mapFromRows(routineRows);
    const committeeCounts = mapFromRows(committeeRows);
    const activeBySession = new Map();
    for (const committee of activeCommittees) {
      const key = String(committee.session);
      if (!activeBySession.has(key)) activeBySession.set(key, []);
      activeBySession.get(key).push(committee.semester);
    }

    return res.json({
      count: batches.length,
      batches: batches.map((b) => {
        const id = String(b._id);
        return {
          id,
          session: b.session,
          batch: b.batch,
          current_semester: b.current_semester,
          status: b.status,
          student_number: b.student_number,
          assignments: assignmentCounts.get(id) || 0,
          routines: routineCounts.get(id) || 0,
          committees: committeeCounts.get(id) || 0,
          active_committee_semesters: activeBySession.get(id) || [],
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/chairman/batches/:id — batch detail for the running semester.
async function getBatchDetail(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(invalidId());

    const bid = new mongoose.Types.ObjectId(id);
    const batch = await Session.findById(bid).lean();
    if (!batch) return next(notFound("Batch not found"));

    const semester = batch.current_semester;

    const [semesterDoc, assignments, routines, committees] = await Promise.all([
      SemesterCourse.findOne({ semester }).populate(
        "course_list",
        "course_code course_name course_type course_credit"
      ),
      CourseAssignment.find({ session: bid, semester })
        .sort({ createdAt: 1 })
        .populate("course", "course_code course_name course_type course_credit")
        .populate("firstExaminers secondExaminer thirdExaminer.teacher", "name email"),
      Routine.find({ session: bid, semester })
        .sort({ date: 1, time: 1 })
        .populate("course", "course_code course_name")
        .populate("invigilators", "name email"),
      ExamCommittee.find({ session: bid })
        .sort({ start: -1 })
        .populate("chairman member1 member2 tabulator1 tabulator2", "name email"),
    ]);

    return res.json({
      data: {
        batch: {
          id: String(batch._id),
          session: batch.session,
          batch: batch.batch,
          current_semester: batch.current_semester,
          status: batch.status,
          student_number: batch.student_number,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
        },
        courses: (semesterDoc?.course_list || []).map((c) => ({
          id: String(c._id),
          course_code: c.course_code,
          course_name: c.course_name,
          course_type: c.course_type,
          course_credit: c.course_credit,
        })),
        assignments,
        routines,
        committees,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export { listTeachers, getTeacherDetail, listBatches, getBatchDetail };
