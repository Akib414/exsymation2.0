import mongoose from "mongoose";

import Teacher from "../models/teacher.model.js";
import DepartmentChairman from "../models/departmentChairman.model.js";
import ExamCommittee from "../models/examCommittee.model.js";
import CourseAssignment from "../models/courseAssignment.model.js";
import Routine from "../models/routine.model.js";
import Session from "../models/session.model.js";
import { startOfDayInTZ } from "../utils/timezone.js";

// Derived roles — never stored on Teacher. External members never log in, never checked.
async function getRoles(teacherId) {
  if (!mongoose.isValidObjectId(teacherId)) return [];
  const id = String(teacherId);

  const teacher = await Teacher.findById(id).select("_id status").lean();
  if (!teacher || teacher.status !== "active") return [];

  const roles = ["teacher"];
  const tid = new mongoose.Types.ObjectId(id);
  const now = new Date();
  // End-inclusive in APP_TIMEZONE: a committee ending today counts for the whole last day.
  const startOfToday = startOfDayInTZ(now);

  const chairmanDoc = await DepartmentChairman.findOne({ teacher: tid, status: "active" })
    .select("_id")
    .lean();
  if (chairmanDoc) roles.push("chairman");

  const committeeDoc = await ExamCommittee.findOne({
    status: "active",
    start: { $lte: now },
    end: { $gte: startOfToday },
    $or: [
      { chairman: tid },
      { member1: tid },
      { member2: tid },
      { tabulator1: tid },
      { tabulator2: tid },
    ],
  })
    .select("_id")
    .lean();
  if (committeeDoc) roles.push("committee");

  // Examiner/invigilator count only within the active Session(s).
  const activeSessions = await Session.find({ status: "active" }).select("_id").lean();
  const sessionIds = activeSessions.map((s) => s._id);

  if (sessionIds.length > 0) {
    const examinerDoc = await CourseAssignment.findOne({
      session: { $in: sessionIds },
      $or: [{ firstExaminers: tid }, { secondExaminer: tid }, { "thirdExaminer.teacher": tid }],
    })
      .select("_id")
      .lean();
    if (examinerDoc) roles.push("examiner");

    const routineDoc = await Routine.findOne({ session: { $in: sessionIds }, invigilators: tid })
      .select("_id")
      .lean();
    if (routineDoc) roles.push("invigilator");
  }

  return [...new Set(roles)];
}

export { getRoles };
