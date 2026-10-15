import mongoose from "mongoose";

import Teacher from "../models/teacher.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import DepartmentChairman from "../models/departmentChairman.model.js";
import { hashPassword } from "../utils/password.util.js";
import { encrypt } from "../utils/crypto.util.js";
import { writeAudit } from "../utils/audit.js";
import { cleanObject } from "../utils/sanitize.js";

// POST /api/admin/teachers — admin only. Single object OR { teachers: [...] }.
async function createTeacher(req, res, next) {
  try {
    const items = Array.isArray(req.body.teachers)
      ? req.body.teachers
      : [req.body];
    const cleanedItems = items.map((t) => cleanObject(t));
    const isBulk = Array.isArray(req.body.teachers);

    const emails = cleanedItems.map((t) => t.email);
    if (new Set(emails).size !== emails.length) {
      const err = new Error("Duplicate email in request");
      err.status = 409;
      return next(err);
    }

    const existing = await Teacher.find({ email: { $in: emails } })
      .select("email")
      .lean();
    if (existing.length > 0) {
      const err = new Error(
        `Email already in use: ${existing.map((e) => e.email).join(", ")}`
      );
      err.status = 409;
      return next(err);
    }

    const docsToInsert = [];
    for (const item of cleanedItems) {
      let encryptedNid = null;
      if (item.nid) {
        try {
          encryptedNid = encrypt(String(item.nid));
        } catch (e) {
          e.status = 500;
          return next(e);
        }
      }
      docsToInsert.push({
        name: item.name,
        email: item.email,
        phone: item.phone,
        nid: encryptedNid,
        photo: item.photo,
        passwordHash: await hashPassword(item.tempPassword),
        status: "active",
        mustChangePassword: true,
        failedAttempts: 0,
        lockUntil: null,
      });
    }

    const docs = await Teacher.insertMany(docsToInsert, { ordered: true });

    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: isBulk ? "teacher.bulk-create" : "teacher.create",
      entity: "Teacher",
      ...(isBulk
        ? { meta: { count: docs.length, emails } }
        : { entityId: docs[0]._id, meta: { email: emails[0] } }),
    });

    if (!isBulk) {
      const teacher = docs[0];
      return res.status(201).json({
        id: String(teacher._id),
        name: teacher.name,
        email: teacher.email,
        mustChangePassword: true,
      });
    }

    return res.status(201).json({
      count: docs.length,
      teachers: docs.map((t) => ({
        id: String(t._id),
        name: t.name,
        email: t.email,
        mustChangePassword: true,
      })),
    });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate email";
    }
    return next(err);
  }
}

// PATCH /api/admin/teachers/:id/deactivate — admin only. Never hard-delete.
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

// PATCH /api/admin/teachers/:id/reactivate — admin only.
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

// GET /api/admin/teachers — admin only. Needed to get ids for deactivate/chairman.
async function listTeachers(req, res, next) {
  try {
    const filter = {};
    if (req.query.status === "active" || req.query.status === "inactive") {
      filter.status = req.query.status;
    }
    const docs = await Teacher.find(filter).sort({ name: 1 }).select("name email phone status mustChangePassword").lean();
    return res.json({
      count: docs.length,
      teachers: docs.map((t) => ({
        id: String(t._id),
        name: t.name,
        email: t.email,
        phone: t.phone,
        status: t.status,
        mustChangePassword: t.mustChangePassword,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export { createTeacher, deactivateTeacher, reactivateTeacher, listTeachers };
