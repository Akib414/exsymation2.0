import mongoose from "mongoose";

import Teacher from "../models/teacher.model.js";
import EmailChangeRequest from "../models/emailChangeRequest.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import Routine from "../models/routine.model.js";
import CourseAssignment from "../models/courseAssignment.model.js";
import DepartmentChairman from "../models/departmentChairman.model.js";
import { getRoles } from "../services/roles.service.js";
import { comparePassword } from "../utils/password.util.js";
import { newResetToken, sha256 } from "../utils/tokens.js";
import { decrypt } from "../utils/crypto.util.js";
import { writeAudit } from "../utils/audit.js";
import logger from "../utils/logger.js";

async function isChairman(viewerId) {
  if (!mongoose.isValidObjectId(viewerId)) return false;
  const doc = await DepartmentChairman.findOne({
    teacher: new mongoose.Types.ObjectId(viewerId),
    status: "active",
  })
    .select("_id")
    .lean();
  return Boolean(doc);
}

function maskNid(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length <= 4) return "***";
  return `***${s.slice(-4)}`;
}

async function me(req, res, next) {
  try {
    const teacher = await Teacher.findById(req.user.sub).select("+nid name email photo status");
    if (!teacher || teacher.status !== "active") {
      const err = new Error("Unauthorized");
      err.status = 401;
      return next(err);
    }
    const roles = await getRoles(teacher._id);
    let nidMasked = null;
    if (teacher.nid) {
      try {
        nidMasked = maskNid(decrypt(teacher.nid));
      } catch {
        nidMasked = null;
      }
    }
    return res.json({
      id: String(teacher._id),
      name: teacher.name,
      email: teacher.email,
      photo: teacher.photo || null,
      nidMasked,
      roles,
    });
  } catch (err) {
    return next(err);
  }
}

// View one teacher: owner gets masked NID; chairman gets full NID (audited).
async function getTeacherById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }
    const viewer = String(req.user.sub);
    const chairman = await isChairman(viewer);
    if (viewer !== String(id) && !chairman) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }
    const teacher = await Teacher.findById(id).select("+nid name email photo phone status");
    if (!teacher) {
      const err = new Error("Not found");
      err.status = 404;
      return next(err);
    }
    let full = null;
    try {
      full = teacher.nid ? decrypt(teacher.nid) : null;
    } catch {
      full = null;
    }
    const isOwner = viewer === String(id);
    if (!isOwner && chairman && full) {
      await writeAudit({
        actor: new mongoose.Types.ObjectId(viewer),
        actorType: "teacher",
        action: "nid.read",
        entity: "Teacher",
        entityId: teacher._id,
      });
      return res.json({
        id: String(teacher._id),
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        photo: teacher.photo,
        status: teacher.status,
        nid: full,
      });
    }
    return res.json({
      id: String(teacher._id),
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      photo: teacher.photo,
      status: teacher.status,
      nidMasked: maskNid(full),
    });
  } catch (err) {
    return next(err);
  }
}

async function requestEmailChange(req, res, next) {
  try {
    const { newEmail, password } = req.body;
    const teacher = await Teacher.findById(req.user.sub).select("+passwordHash email status");
    if (!teacher || teacher.status !== "active") {
      const err = new Error("Unauthorized");
      err.status = 401;
      return next(err);
    }
    const ok = await comparePassword(password, teacher.passwordHash);
    if (!ok) {
      const err = new Error("Invalid credentials");
      err.status = 401;
      return next(err);
    }
    const exists = await Teacher.findOne({ email: newEmail }).select("_id").lean();
    if (exists) {
      const err = new Error("Email already in use");
      err.status = 409;
      return next(err);
    }
    // Invalidate older pending requests before issuing a new one.
    await EmailChangeRequest.updateMany(
      { teacher: teacher._id, used: false, expiresAt: { $gt: new Date() } },
      { $set: { used: true } }
    );
    const raw = newResetToken();
    try {
      await EmailChangeRequest.create({
        teacher: teacher._id,
        newEmail,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        used: false,
      });
    } catch (e) {
      if (e.code === 11000) {
        e.status = 409;
        e.message = "Duplicate key";
      }
      throw e;
    }
    // TODO: send verification link to NEW email. Log only outside production.
    if (process.env.NODE_ENV !== "production") {
      logger.info(`Email change token for ${newEmail}: ${raw}`);
    }
    await writeAudit({
      actor: teacher._id,
      actorType: "teacher",
      action: "email.request",
      entity: "Teacher",
      entityId: teacher._id,
      meta: { newEmail },
    });
    return res.json({ ok: true, message: "Verification link sent to new email" });
  } catch (err) {
    return next(err);
  }
}

async function confirmEmailChange(req, res, next) {
  try {
    const { token } = req.body;
    const record = await EmailChangeRequest.findOne({ tokenHash: sha256(token), used: false });
    if (!record || record.expiresAt < new Date()) {
      const err = new Error("Invalid or expired token");
      err.status = 400;
      return next(err);
    }
    // Request must belong to the logged-in teacher.
    if (String(record.teacher) !== String(req.user.sub)) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }
    const taken = await Teacher.findOne({ email: record.newEmail }).select("_id").lean();
    if (taken && String(taken._id) !== String(record.teacher)) {
      const err = new Error("Email already in use");
      err.status = 409;
      return next(err);
    }
    const teacher = await Teacher.findById(record.teacher).select("email status");
    if (!teacher || teacher.status !== "active") {
      const err = new Error("Invalid or expired token");
      err.status = 400;
      return next(err);
    }
    const oldEmail = teacher.email;
    teacher.email = record.newEmail;
    await teacher.save();

    record.used = true;
    await record.save();

    await RefreshToken.updateMany(
      { actor: teacher._id, actorType: "teacher", revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
    await writeAudit({
      actor: teacher._id,
      actorType: "teacher",
      action: "email.change",
      entity: "Teacher",
      entityId: teacher._id,
      meta: { oldEmail, newEmail: record.newEmail },
    });
    logger.info(`Email changed for teacher ${teacher._id}; notify old email ${oldEmail}`);
    return res.json({ ok: true, email: record.newEmail });
  } catch (err) {
    return next(err);
  }
}

// Object-level: only routines where invigilators contains own id.
async function duties(req, res, next) {
  try {
    const tid = new mongoose.Types.ObjectId(req.user.sub);
    const routines = await Routine.find({ invigilators: tid })
      .populate("course", "course_code course_name")
      .populate("session", "session")
      .sort({ date: 1 })
      .lean();
    return res.json({ data: routines });
  } catch (err) {
    return next(err);
  }
}

// Object-level: only assignments where teacher is an examiner.
async function assignments(req, res, next) {
  try {
    const tid = new mongoose.Types.ObjectId(req.user.sub);
    const rows = await CourseAssignment.find({
      $or: [{ firstExaminers: tid }, { secondExaminer: tid }, { "thirdExaminer.teacher": tid }],
    })
      .populate("course", "course_code course_name")
      .populate("session", "session")
      .lean();
    return res.json({ data: rows });
  } catch (err) {
    return next(err);
  }
}

export { me, getTeacherById, requestEmailChange, confirmEmailChange, duties, assignments };
