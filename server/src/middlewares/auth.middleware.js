import mongoose from "mongoose";

import { verifyTeacherAccess, verifyAdminAccess } from "../utils/jwt.js";
import DepartmentChairman from "../models/departmentChairman.model.js";
import Teacher from "../models/teacher.model.js";
import Admin from "../models/admin.model.js";

function bearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

// Teacher JWT -> req.user = { sub, roles, type: 'teacher' }.
// Verifies signature/aud, then checks Teacher.status='active' from DB on every request,
// so a deactivated teacher loses access even with a live token.
async function protectTeacher(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    const err = new Error("Unauthorized");
    err.status = 401;
    return next(err);
  }
  try {
    const payload = verifyTeacherAccess(token);
    if (!mongoose.isValidObjectId(payload.sub)) {
      const err = new Error("Unauthorized");
      err.status = 401;
      return next(err);
    }
    const teacher = await Teacher.findById(payload.sub).select("status").lean();
    if (!teacher || teacher.status !== "active") {
      const err = new Error("Unauthorized");
      err.status = 401;
      return next(err);
    }
    req.user = { sub: String(payload.sub), roles: payload.roles || [], type: "teacher" };
    return next();
  } catch {
    const err = new Error("Unauthorized");
    err.status = 401;
    return next(err);
  }
}

// Admin JWT -> req.user = { sub, type: 'admin' }. Checks isActive on every request.
async function protectAdmin(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    const err = new Error("Unauthorized");
    err.status = 401;
    return next(err);
  }
  try {
    const payload = verifyAdminAccess(token);
    const admin = await Admin.findById(payload.sub).select("isActive").lean();
    if (!admin || !admin.isActive) {
      const err = new Error("Unauthorized");
      err.status = 401;
      return next(err);
    }
    req.user = { sub: String(payload.sub), roles: [], type: "admin" };
    return next();
  } catch {
    const err = new Error("Unauthorized");
    err.status = 401;
    return next(err);
  }
}

// Block everything until first-login password is changed.
// Router-level deny-by-default: mount after protectTeacher, allow-list only
// change-password (auth router), GET /me (me router) and logout.
async function requirePasswordChanged(req, res, next) {
  try {
    if (!req.user || req.user.type !== "teacher") return next();
    const teacher = await Teacher.findById(req.user.sub).select("mustChangePassword").lean();
    if (teacher && teacher.mustChangePassword) {
      const err = new Error("Password change required");
      err.status = 403;
      return next(err);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles) || !req.user.roles.includes(role)) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }
    return next();
  };
}

function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }
    const ok = roles.some((r) => req.user.roles.includes(r));
    if (!ok) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }
    return next();
  };
}

// Token roles can be up to 15 min stale — re-check DB for sensitive actions.
// Checks BOTH the chairman row AND the teacher's own status.
function requireChairmanStrict(req, res, next) {
  (async () => {
    if (!req.user || !mongoose.isValidObjectId(req.user.sub)) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }
    const teacherId = new mongoose.Types.ObjectId(req.user.sub);
    const [teacher, chair] = await Promise.all([
      Teacher.findById(teacherId).select("status").lean(),
      DepartmentChairman.findOne({ teacher: teacherId, status: "active" })
        .select("_id")
        .lean(),
    ]);
    if (!teacher || teacher.status !== "active" || !chair) {
      const err = new Error("Chairman only");
      err.status = 403;
      return next(err);
    }
    return next();
  })().catch(next);
}

export {
  protectTeacher,
  protectAdmin,
  requirePasswordChanged,
  requireRole,
  requireAnyRole,
  requireChairmanStrict,
};
