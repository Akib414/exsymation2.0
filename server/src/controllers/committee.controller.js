import mongoose from "mongoose";

import ExamCommittee from "../models/examCommittee.model.js";
import Teacher from "../models/teacher.model.js";
import Session from "../models/session.model.js";
import DepartmentChairman from "../models/departmentChairman.model.js";
import { writeAudit } from "../utils/audit.js";
import { endOfDayInTZ, startOfDayInTZ } from "../utils/timezone.js";

async function ensureActiveTeachers(ids) {
  const unique = [...new Set(ids.map(String))];
  const docs = await Teacher.find({ _id: { $in: unique } }).select("_id status").lean();
  if (docs.length !== unique.length) {
    const err = new Error("One or more teachers not found");
    err.status = 400;
    throw err;
  }
  const inactive = docs.find((d) => d.status !== "active");
  if (inactive) {
    const err = new Error("All committee members must be active teachers");
    err.status = 400;
    throw err;
  }
}

// POST /api/committees — chairman only (route uses requireChairmanStrict).
async function createCommittee(req, res, next) {
  try {
    const { chairman, member1, member2, tabulator1, tabulator2, external, session, semester, start, end, status } =
      req.body;

    const ids = [chairman, member1, member2];
    if (tabulator1) ids.push(tabulator1);
    if (tabulator2) ids.push(tabulator2);

    // Five teacher slots must be distinct people.
    if (new Set(ids.map(String)).size !== ids.length) {
      const err = new Error("Committee members must be five distinct teachers");
      err.status = 400;
      return next(err);
    }
    await ensureActiveTeachers(ids);

    if (!mongoose.isValidObjectId(session)) {
      const err = new Error("Invalid session id");
      err.status = 400;
      return next(err);
    }
    const sessionDoc = await Session.findById(session).select("_id").lean();
    if (!sessionDoc) {
      const err = new Error("Session not found");
      err.status = 404;
      return next(err);
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!(startDate < endDate)) {
      const err = new Error("start must be before end");
      err.status = 400;
      return next(err);
    }

    // No overlapping active committee for the same session + semester.
    // End is inclusive of the whole last day in APP_TIMEZONE.
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
      const err = new Error("Overlapping active committee for this session and semester");
      err.status = 409;
      return next(err);
    }

    const doc = await ExamCommittee.create({
      chairman,
      member1,
      member2,
      tabulator1: tabulator1 || null,
      tabulator2: tabulator2 || null,
      external: external || null,
      session,
      semester,
      start: startDate,
      end: endDate,
      status: status || "active",
    });

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "teacher",
      action: "committee.create",
      entity: "ExamCommittee",
      entityId: doc._id,
      meta: { semester, session },
    });
    return res.status(201).json({ data: doc });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate key";
    }
    return next(err);
  }
}

// GET /api/committees — chairman sees all; others see only committees they belong to + active term.
async function listCommittees(req, res, next) {
  try {
    const tid = new mongoose.Types.ObjectId(req.user.sub);
    const isChairman = req.user.roles?.includes("chairman");
    const now = new Date();
    const startOfToday = startOfDayInTZ(now);
    const filter = isChairman
      ? {}
      : {
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
        };

    if (req.query.session !== undefined) {
      if (!mongoose.isValidObjectId(req.query.session)) {
        const err = new Error("Invalid session id");
        err.status = 400;
        return next(err);
      }
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

    if (isChairman && (req.query.status === "active" || req.query.status === "inactive")) {
      filter.status = req.query.status;
    }

    const rows = await ExamCommittee.find(filter)
      .sort({ createdAt: -1 })
      .populate("chairman member1 member2 tabulator1 tabulator2", "name email")
      .populate("session", "session batch")
      .lean();
    return res.json({ data: rows });
  } catch (err) {
    return next(err);
  }
}

// Chairman handover in ONE transaction: deactivate old, create new.
async function changeChairman(req, res, next) {
  const session = await mongoose.startSession();
  try {
    const { newTeacherId } = req.body;
    const teacher = await Teacher.findById(newTeacherId).select("_id status").lean();
    if (!teacher || teacher.status !== "active") {
      const err = new Error("New chairman must be an active teacher");
      err.status = 400;
      throw err;
    }

    let result;
    await session.withTransaction(async () => {
      const current = await DepartmentChairman.findOne({ status: "active" }).session(session);
      if (current) {
        current.status = "inactive";
        current.endDate = new Date();
        await current.save({ session });
      }
      const created = await DepartmentChairman.create(
        [{ teacher: newTeacherId, status: "active", startDate: new Date() }],
        { session }
      );
      result = created[0];

      await writeAudit({
        actor: new mongoose.Types.ObjectId(req.user.sub),
        actorType: req.user.type === "admin" ? "admin" : "teacher",
        action: "chairman.change",
        entity: "DepartmentChairman",
        entityId: result._id,
        meta: { previous: current?._id, next: newTeacherId },
      });
    });

    return res.status(201).json({ data: result });
  } catch (err) {
    return next(err);
  } finally {
    await session.endSession();
  }
}

// GET /api/admin/chairmen/current — admin only. Read-only: who is active now.
async function getCurrentChairman(req, res, next) {
  try {
    const current = await DepartmentChairman.findOne({ status: "active" })
      .populate("teacher", "name email phone status")
      .lean();
    if (!current || !current.teacher) return res.json({ data: null });
    return res.json({
      data: {
        id: String(current._id),
        teacher: {
          id: String(current.teacher._id),
          name: current.teacher.name,
          email: current.teacher.email,
          phone: current.teacher.phone,
          status: current.teacher.status,
        },
        startDate: current.startDate,
      },
    });
  } catch (err) {
    return next(err);
  }
}

const COMMITTEE_SLOTS = ["chairman", "member1", "member2", "tabulator1", "tabulator2"];

function teacherIdOf(value) {
  if (!value) return null;
  return String(value._id || value);
}

async function isActiveChairman(teacherId) {
  const doc = await DepartmentChairman.findOne({ teacher: teacherId, status: "active" })
    .select("_id")
    .lean();
  return Boolean(doc);
}

// GET /api/committees/:id — chairman or any member of that committee.
async function getCommittee(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }

    const doc = await ExamCommittee.findById(id)
      .populate("chairman member1 member2 tabulator1 tabulator2", "name email")
      .populate("session", "session batch")
      .lean();
    if (!doc) {
      const err = new Error("Committee not found");
      err.status = 404;
      return next(err);
    }

    const tid = String(req.user.sub);
    const isMember = COMMITTEE_SLOTS.some((slot) => teacherIdOf(doc[slot]) === tid);
    const chairman = await isActiveChairman(new mongoose.Types.ObjectId(tid));
    if (!isMember && !chairman) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }

    return res.json({ data: doc });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/committees/:id — chairman only. Partial update, re-validated.
async function updateCommittee(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }

    const doc = await ExamCommittee.findById(id);
    if (!doc) {
      const err = new Error("Committee not found");
      err.status = 404;
      return next(err);
    }

    const chairman = req.body.chairman ?? doc.chairman;
    const member1 = req.body.member1 ?? doc.member1;
    const member2 = req.body.member2 ?? doc.member2;
    const tabulator1 = req.body.tabulator1 ?? doc.tabulator1;
    const tabulator2 = req.body.tabulator2 ?? doc.tabulator2;
    const session = req.body.session ?? doc.session;
    const semester = req.body.semester ?? doc.semester;
    const startDate = req.body.start ? new Date(req.body.start) : doc.start;
    const endDate = req.body.end ? new Date(req.body.end) : doc.end;
    const status = req.body.status ?? doc.status;

    const ids = [chairman, member1, member2];
    if (tabulator1) ids.push(tabulator1);
    if (tabulator2) ids.push(tabulator2);
    if (new Set(ids.map(String)).size !== ids.length) {
      const err = new Error("Committee members must be distinct teachers");
      err.status = 400;
      return next(err);
    }
    await ensureActiveTeachers(ids);

    if (!mongoose.isValidObjectId(session)) {
      const err = new Error("Invalid session id");
      err.status = 400;
      return next(err);
    }
    const sessionDoc = await Session.findById(session).select("_id").lean();
    if (!sessionDoc) {
      const err = new Error("Session not found");
      err.status = 404;
      return next(err);
    }

    if (!(startDate < endDate)) {
      const err = new Error("start must be before end");
      err.status = 400;
      return next(err);
    }

    if (status === "active") {
      const overlap = await ExamCommittee.findOne({
        _id: { $ne: doc._id },
        session: new mongoose.Types.ObjectId(session),
        semester,
        status: "active",
        start: { $lte: endOfDayInTZ(endDate) },
        end: { $gte: startDate },
      })
        .select("_id")
        .lean();
      if (overlap) {
        const err = new Error("Overlapping active committee for this session and semester");
        err.status = 409;
        return next(err);
      }
    }

    doc.chairman = chairman;
    doc.member1 = member1;
    doc.member2 = member2;
    doc.tabulator1 = tabulator1 || null;
    doc.tabulator2 = tabulator2 || null;
    doc.session = session;
    doc.semester = semester;
    doc.start = startDate;
    doc.end = endDate;
    doc.status = status;
    if (req.body.external !== undefined) doc.external = req.body.external;

    await doc.save();

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: req.user.type === "admin" ? "admin" : "teacher",
      action: "committee.update",
      entity: "ExamCommittee",
      entityId: doc._id,
      meta: { updated: Object.keys(req.body) },
    });

    await doc.populate([
      { path: "chairman member1 member2 tabulator1 tabulator2", select: "name email" },
      { path: "session", select: "session batch" },
    ]);
    return res.json({ data: doc });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate key";
    }
    return next(err);
  }
}

// DELETE /api/committees/:id — chairman only. Soft-deactivate, never delete.
async function deactivateCommittee(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }

    const doc = await ExamCommittee.findById(id);
    if (!doc) {
      const err = new Error("Committee not found");
      err.status = 404;
      return next(err);
    }

    if (doc.status !== "inactive") {
      doc.status = "inactive";
      await doc.save();
      await writeAudit({
        actor: new mongoose.Types.ObjectId(req.user.sub),
        actorType: req.user.type === "admin" ? "admin" : "teacher",
        action: "committee.deactivate",
        entity: "ExamCommittee",
        entityId: doc._id,
        meta: { session: String(doc.session), semester: doc.semester },
      });
    }

    await doc.populate([
      { path: "chairman member1 member2 tabulator1 tabulator2", select: "name email" },
      { path: "session", select: "session batch" },
    ]);
    return res.json({ data: doc });
  } catch (err) {
    return next(err);
  }
}

export {
  createCommittee,
  listCommittees,
  getCommittee,
  updateCommittee,
  deactivateCommittee,
  changeChairman,
  getCurrentChairman,
};
