import mongoose from "mongoose";

import ExamCommittee from "../models/examCommittee.model.js";
import Routine from "../models/routine.model.js";
import Session from "../models/session.model.js";
import Teacher from "../models/teacher.model.js";
import TeacherCommitteeClaim from "../models/teacherCommitteeClaim.model.js";
import { writeAudit } from "../utils/audit.js";
import { appTimeZone, endOfDayInTZ, startOfDayInTZ } from "../utils/timezone.js";

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

// A committee reserves its teachers while it is still open: active and not yet
// finished. Completed and inactive committees release their teachers again.
function openCommitteeFilter(startOfToday) {
  return { status: "active", end: { $gte: startOfToday } };
}

function reservedSlots(committees) {
  const map = new Map();
  for (const committee of committees) {
    for (const [slot] of COMMITTEE_SLOTS) {
      const person = committee[slot];
      if (!person?._id) continue;
      map.set(String(person._id), {
        teacherId: String(person._id),
        name: person.name || "Unknown teacher",
        committee: {
          id: String(committee._id),
          identifier: `${committee.session?.batch || "Batch"} · Semester ${committee.semester}`,
          state: committeeState(committee, new Date(), startOfDayInTZ(new Date())),
        },
      });
    }
  }
  return map;
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

    return res.json({
      count: committees.length,
      total: all.length,
      upcomingExamTotal: examRows.reduce((sum, row) => sum + row.count, 0),
      committees,
    });
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

// GET /api/chairman/committees/eligible-teachers — who may be assigned right now.
async function listEligibleTeachers(req, res, next) {
  try {
    const now = new Date();
    const startOfToday = startOfDayInTZ(now);

    const open = await ExamCommittee.find(openCommitteeFilter(startOfToday))
      .populate("chairman member1 member2 tabulator1 tabulator2", "name")
      .populate("session", "session batch")
      .lean();

    const reserved = reservedSlots(open);
    const teachers = await Teacher.find({ status: "active" }).sort({ name: 1 }).select("name").lean();

    const eligible = [];
    const unavailable = [];
    for (const teacher of teachers) {
      const id = String(teacher._id);
      const conflict = reserved.get(id);
      if (conflict) {
        unavailable.push({
          id,
          name: teacher.name,
          reason: "Already assigned to an open examination committee",
          committee: conflict.committee,
        });
      } else {
        eligible.push({ id, name: teacher.name });
      }
    }

    return res.json({ eligible, unavailable, total: teachers.length });
  } catch (err) {
    return next(err);
  }
}

// POST /api/chairman/committees — create a committee with availability enforced.
async function createChairmanCommittee(req, res, next) {
  const createdClaims = [];

  try {
    const { chairman, member1, member2, session, semester, start, end } = req.body;

    const ids = [chairman, member1, member2];
    if (new Set(ids.map(String)).size !== ids.length) {
      const err = new Error("Committee chairman, member 1, and member 2 must be three different teachers");
      err.status = 400;
      return next(err);
    }

    if (!mongoose.isValidObjectId(session)) {
      const err = new Error("Invalid batch id");
      err.status = 400;
      return next(err);
    }
    const sessionDoc = await Session.findById(session).select("_id").lean();
    if (!sessionDoc) {
      const err = new Error("Batch not found");
      err.status = 404;
      return next(err);
    }

    const teachers = await Teacher.find({ _id: { $in: ids } }).select("_id name status").lean();
    if (teachers.length !== ids.length) {
      const err = new Error("One or more selected teachers were not found");
      err.status = 400;
      return next(err);
    }
    const inactive = teachers.find((teacher) => teacher.status !== "active");
    if (inactive) {
      const err = new Error(`Teacher ${inactive.name} is not an active teacher`);
      err.status = 400;
      return next(err);
    }

    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (!(startDate < endDate)) {
      const err = new Error("Start date must be before the end date");
      err.status = 400;
      return next(err);
    }

    const now = new Date();
    const startOfToday = startOfDayInTZ(now);

    const open = await ExamCommittee.find(openCommitteeFilter(startOfToday))
      .populate("chairman member1 member2 tabulator1 tabulator2", "name")
      .populate("session", "session batch")
      .lean();
    const reserved = reservedSlots(open);
    for (const teacher of teachers) {
      const conflict = reserved.get(String(teacher._id));
      if (conflict) {
        const err = new Error(
          `Teacher ${teacher.name} is already assigned to the running examination committee ${conflict.committee.identifier}`
        );
        err.status = 409;
        err.details = {
          teacherId: String(teacher._id),
          teacherName: teacher.name,
          committeeId: conflict.committee.id,
        };
        return next(err);
      }
    }

    const overlap = await ExamCommittee.findOne({
      session: new mongoose.Types.ObjectId(session),
      semester,
      status: "active",
      start: { $lte: endOfDayInTZ(endDate) },
      end: { $gte: startDate },
    })
      .select("_id")
      .lean();
    if (overlap) {
      const err = new Error("Overlapping active committee for this batch and semester");
      err.status = 409;
      return next(err);
    }

    // Database-level lock: the unique index on the claim collection rejects a
    // second concurrent request that reserves the same teacher.
    const existingClaims = await TeacherCommitteeClaim.find({ teacher: { $in: ids } });
    if (existingClaims.length > 0) {
      const claimCommittees = await ExamCommittee.find({
        _id: { $in: existingClaims.map((claim) => claim.committee).filter(Boolean) },
      })
        .select("status end")
        .lean();
      const stillOpen = new Set(
        claimCommittees
          .filter((committee) => committee.status === "active" && committee.end >= startOfToday)
          .map((committee) => String(committee._id))
      );
      const stale = existingClaims.filter(
        (claim) => !claim.committee || !stillOpen.has(String(claim.committee))
      );
      if (stale.length > 0) {
        await TeacherCommitteeClaim.deleteMany({ _id: { $in: stale.map((claim) => claim._id) } });
      }
    }

    try {
      const claims = await TeacherCommitteeClaim.insertMany(
        ids.map((teacherId) => ({
          teacher: teacherId,
          committee: null,
          session,
          semester,
          start: startDate,
          end: endDate,
        })),
        { ordered: true }
      );
      createdClaims.push(...claims.map((claim) => claim._id));
    } catch (claimError) {
      if (claimError.code === 11000) {
        const blocked = await TeacherCommitteeClaim.findOne({ teacher: { $in: ids } })
          .populate("teacher", "name")
          .lean();
        if (createdClaims.length > 0) {
          await TeacherCommitteeClaim.deleteMany({ _id: { $in: createdClaims } });
        }
        const err = new Error(
          `Teacher ${blocked?.teacher?.name || "selected"} is already assigned to a running examination committee`
        );
        err.status = 409;
        return next(err);
      }
      throw claimError;
    }

    let created;
    try {
      created = await ExamCommittee.create({
        chairman,
        member1,
        member2,
        tabulator1: null,
        tabulator2: null,
        external: null,
        session,
        semester,
        start: startDate,
        end: endDate,
        status: "active",
      });
    } catch (createError) {
      if (createdClaims.length > 0) {
        await TeacherCommitteeClaim.deleteMany({ _id: { $in: createdClaims } });
      }
      throw createError;
    }

    if (createdClaims.length > 0) {
      await TeacherCommitteeClaim.updateMany(
        { _id: { $in: createdClaims } },
        { $set: { committee: created._id } }
      );
    }

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "teacher",
      action: "committee.create",
      entity: "ExamCommittee",
      entityId: created._id,
      meta: { semester, session, source: "chairman" },
    });

    const shaped = shapeCommittee(created.toObject(), now, startOfToday);
    return res.status(201).json({ data: { ...shaped, upcomingExams: [] } });
  } catch (err) {
    if (createdClaims.length > 0 && !err.status) {
      await TeacherCommitteeClaim.deleteMany({ _id: { $in: createdClaims } });
    }
    return next(err);
  }
}

export {
  listChairmanCommittees,
  getChairmanCommittee,
  listEligibleTeachers,
  createChairmanCommittee,
};
