import crypto from "crypto";
import mongoose from "mongoose";

import Teacher from "../models/teacher.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import DepartmentChairman from "../models/departmentChairman.model.js";
import { hashPassword } from "../utils/password.util.js";
import { encrypt } from "../utils/crypto.util.js";
import { writeAudit } from "../utils/audit.js";
import { cleanObject } from "../utils/sanitize.js";

// POST /api/teachers — chairman only. Creates teacher with temp password.
async function createTeacher(req, res, next) {
  try {
    const cleaned = cleanObject(req.body);
    const { name, email, phone, nid, photo, tempPassword } = cleaned;

    const exists = await Teacher.findOne({ email }).select("_id").lean();
    if (exists) {
      const err = new Error("Email already in use");
      err.status = 409;
      return next(err);
    }

    let encryptedNid = null;
    if (nid) {
      try {
        encryptedNid = encrypt(String(nid));
      } catch (e) {
        e.status = 500;
        return next(e);
      }
    }

    const teacher = await Teacher.create({
      name,
      email,
      phone,
      nid: encryptedNid,
      photo,
      passwordHash: await hashPassword(tempPassword),
      status: "active",
      mustChangePassword: true,
      failedAttempts: 0,
      lockUntil: null,
    });

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: req.user.type === "admin" ? "admin" : "teacher",
      action: "teacher.create",
      entity: "Teacher",
      entityId: teacher._id,
      meta: { email },
    });

    return res.status(201).json({
      id: String(teacher._id),
      name: teacher.name,
      email: teacher.email,
      mustChangePassword: true,
    });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/teachers/:id/deactivate — chairman only. Never hard-delete.
// Refuses the active chairman: handover first. Revokes all sessions.
async function deactivateTeacher(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      const err = new Error("Not found");
      err.status = 404;
      return next(err);
    }
    const chair = await DepartmentChairman.findOne({ teacher: teacher._id, status: "active" })
      .select("_id")
      .lean();
    if (chair) {
      const err = new Error("Cannot deactivate the active chairman — handover first");
      err.status = 400;
      return next(err);
    }
    teacher.status = "inactive";
    await teacher.save();

    // Revoke all sessions immediately — inactive teachers cannot refresh.
    await RefreshToken.updateMany(
      { actor: teacher._id, actorType: "teacher", revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: req.user.type === "admin" ? "admin" : "teacher",
      action: "teacher.deactivate",
      entity: "Teacher",
      entityId: teacher._id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/teachers/:id/reactivate — chairman only.
async function reactivateTeacher(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      const err = new Error("Not found");
      err.status = 404;
      return next(err);
    }
    teacher.status = "active";
    teacher.failedAttempts = 0;
    teacher.lockUntil = null;
    await teacher.save();

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: req.user.type === "admin" ? "admin" : "teacher",
      action: "teacher.reactivate",
      entity: "Teacher",
      entityId: teacher._id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

// POST /api/teachers/:id/reset-password — chairman only.
// Issues a random temp password, forces change, revokes all sessions.
async function resetTeacherPassword(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }
    const teacher = await Teacher.findById(id).select("+passwordHash status");
    if (!teacher) {
      const err = new Error("Not found");
      err.status = 404;
      return next(err);
    }
    if (teacher.status !== "active") {
      const err = new Error("Teacher is not active");
      err.status = 400;
      return next(err);
    }
    const tempPassword = crypto.randomBytes(12).toString("hex");
    teacher.passwordHash = await hashPassword(tempPassword);
    teacher.mustChangePassword = true;
    teacher.failedAttempts = 0;
    teacher.lockUntil = null;
    await teacher.save();

    await RefreshToken.updateMany(
      { actor: teacher._id, actorType: "teacher", revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: req.user.type === "admin" ? "admin" : "teacher",
      action: "teacher.reset-password",
      entity: "Teacher",
      entityId: teacher._id,
    });
    // Temp password leaves the server only here. No-store, never logged/audited.
    res.set("Cache-Control", "no-store");
    return res.json({ ok: true, tempPassword });
  } catch (err) {
    return next(err);
  }
}

export { createTeacher, deactivateTeacher, reactivateTeacher, resetTeacherPassword };
