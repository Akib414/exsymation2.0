import mongoose from "mongoose";

import ExamCommittee from "../models/examCommittee.model.js";
import Routine from "../models/routine.model.js";
import { appTimeZone, startOfDayInTZ } from "../utils/timezone.js";

const COMMITTEE_SLOTS = [
  ["chairman", "Committee chairman"],
  ["member1", "Member 1"],
  ["member2", "Member 2"],
  ["tabulator1", "Tabulator 1"],
  ["tabulator2", "Tabulator 2"],
];

const STATES = ["running", "scheduled", "completed", "inactive"];

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

function calendarDay(date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(date);
}

function personOf(value) {
  if (!value) return null;
  const id = String(value._id || value);
  if (!id) return null;
  return { id, name: value.name || "Unknown teacher" };
}

// A committee counts as running while it is active and its date window covers today.
function committeeState(committee, now, startOfToday) {
  if (committee.status !== "active") return "inactive";
  if (committee.start > now) return "scheduled";
  if (committee.end < startOfToday) return "completed";
  return "running";
}

function shapeCommittee(committee, now, startOfToday) {
  const batch = committee.session?.batch || null;
  const academicSession = committee.session?.session || null;
  const members = COMMITTEE_SLOTS.map(([slot, role]) => {
    const person = personOf(committee[slot]);
    return person ? { ...person, role } : null;
  }).filter(Boolean);

  return {
    id: String(committee._id),
    identifier: `${batch || "Batch"} · Semester ${committee.semester}`,
    academicSession,
    batch,
    sessionId: committee.session?._id ? String(committee.session._id) : String(committee.session),
    semester: committee.semester,
    start: committee.start,
    end: committee.end,
    status: committee.status,
    state: committeeState(committee, now, startOfToday),
    chairman: personOf(committee.chairman),
    member1: personOf(committee.member1),
    member2: personOf(committee.member2),
    members,
    memberCount: members.length,
    external: committee.external
      ? { name: committee.external.name, institution: committee.external.institution || null }
      : null,
  };
}

function shapeExam(routine, today) {
  const course = routine.course || {};
  return {
    id: String(routine._id),
    name: course.course_name || "Examination",
    type: course.course_type || null,
    course: {
      code: course.course_code || null,
      name: course.course_name || null,
      type: course.course_type || null,
    },
    semester: routine.semester,
    date: routine.date,
    time: routine.time || null,
    status: calendarDay(routine.date) === today ? "Today" : "Scheduled",
  };
}

function matchesQuery(committee, needle) {
  if (!needle) return true;
  const haystack = [
    committee.identifier,
    committee.batch,
    committee.academicSession,
    committee.chairman?.name,
    ...committee.members.map((member) => member.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

// GET /api/chairman/committees — every committee with composition and running state.
async function listChairmanCommittees(req, res, next) {
  try {
    const now = new Date();
    const startOfToday = startOfDayInTZ(now);

    const filter = {};
    if (req.query.session !== undefined) {
      if (!mongoose.isValidObjectId(req.query.session)) return next(invalidId("Invalid session id"));
      filter.session = new mongoose.Types.ObjectId(req.query.session);
    }
    if (req.query.semester !== undefined) {
      const semester = Number(req.query.semester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 10) {
        const err = new Error("Invalid semester");
        err.status = 400;
        return next(err);
      }
      filter.semester = semester;
    }

    const rows = await ExamCommittee.find(filter)
      .sort({ start: -1 })
      .populate("chairman member1 member2 tabulator1 tabulator2", "name")
      .populate("session", "session batch")
      .lean();

    const all = rows.map((row) => shapeCommittee(row, now, startOfToday));

    const examRows = await Routine.aggregate([
      { $match: { date: { $gte: startOfToday } } },
      { $group: { _id: { session: "$session", semester: "$semester" }, count: { $sum: 1 } } },
    ]);
    const examCounts = new Map();
    for (const row of examRows) {
      examCounts.set(`${row._id.session}:${row._id.semester}`, row.count);
    }

    const state = req.query.state;
    if (state !== undefined && !STATES.includes(state)) {
      const err = new Error("Invalid state");
      err.status = 400;
      return next(err);
    }

    const needle =
      typeof req.query.q === "string" && req.query.q.trim()
        ? req.query.q.trim().slice(0, 100).toLowerCase()
        : "";

    const committees = all
      .map((committee) => ({
        ...committee,
        upcomingExamCount: examCounts.get(`${committee.sessionId}:${committee.semester}`) || 0,
      }))
      .filter((committee) => (state ? committee.state === state : true))
      .filter((committee) => matchesQuery(committee, needle));

    return res.json({ count: committees.length, total: all.length, committees });
  } catch (err) {
    return next(err);
  }
}

// GET /api/chairman/committees/:id — one committee plus its upcoming examinations.
async function getChairmanCommittee(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(invalidId());

    const now = new Date();
    const startOfToday = startOfDayInTZ(now);
    const today = calendarDay(now);

    const committee = await ExamCommittee.findById(id)
      .populate("chairman member1 member2 tabulator1 tabulator2", "name")
      .populate("session", "session batch")
      .lean();
    if (!committee) return next(notFound("Committee not found"));

    const sessionId = committee.session?._id || committee.session;
    const exams = await Routine.find({
      session: sessionId,
      semester: committee.semester,
      date: { $gte: startOfToday },
    })
      .sort({ date: 1, time: 1 })
      .populate("course", "course_code course_name course_type")
      .lean();

    const shaped = shapeCommittee(committee, now, startOfToday);

    return res.json({
      data: {
        ...shaped,
        upcomingExams: exams.map((routine) => shapeExam(routine, today)),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export { listChairmanCommittees, getChairmanCommittee };
