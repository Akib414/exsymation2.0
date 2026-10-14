import mongoose from "mongoose";

import ExamCommittee from "../models/examCommittee.model.js";
import Teacher from "../models/teacher.model.js";
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
    const rows = await ExamCommittee.find(filter).sort({ createdAt: -1 }).lean();
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

export { createCommittee, listCommittees, changeChairman };
