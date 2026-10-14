import mongoose from "mongoose";

import Teacher from "../models/teacher.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import PasswordReset from "../models/passwordReset.model.js";
import { signTeacherAccess } from "../utils/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.util.js";
import { newRefreshToken, newResetToken, sha256 } from "../utils/tokens.js";
import { getRoles } from "../services/roles.service.js";
import { teacherRefreshCookieOptions, clearTeacherRefreshCookie } from "../utils/cookies.js";
import { writeAudit } from "../utils/audit.js";
import logger from "../utils/logger.js";
import { checkIpLock, recordIpFailure, clearIpFailures } from "../utils/lockout.js";

const MAX_FAILED = 20;
const LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 10 * 1000;

// Precomputed bcrypt hash — compared on unknown-email logins to equalize timing.
const DUMMY_HASH = "$2b$12$pwQgcGrdsxxHSluvKRImw.n9/sTuC0SpOpgtE78l7ioUUPoKcYgxu";

function invalidCredentials() {
  const err = new Error("Invalid credentials");
  err.status = 401;
  return err;
}

function passwordTooLong(password) {
  return Buffer.byteLength(String(password), "utf8") > 72;
}

async function recordFailedAttempt(teacherId) {
  await Teacher.updateOne({ _id: teacherId }, { $inc: { failedAttempts: 1 } });
  const fresh = await Teacher.findById(teacherId).select("failedAttempts").lean();
  if (fresh && fresh.failedAttempts >= MAX_FAILED) {
    // Account-wide fallback (20 fails). Per-IP lock handled via LoginAttempt.
    // Cap exponent at 2 -> 15m, 30m, 60m max 1h.
    const excess = Math.min(fresh.failedAttempts - MAX_FAILED, 2);
    const delay = Math.min(LOCK_MS * 2 ** excess, MAX_LOCK_MS);
    await Teacher.updateOne(
      { _id: teacherId },
      { $set: { lockUntil: new Date(Date.now() + delay) } }
    );
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (passwordTooLong(password)) return next(invalidCredentials());
    // Per account+IP lock first — same generic error, no oracle.
    if (await checkIpLock(email, req.ip)) return next(invalidCredentials());

    const teacher = await Teacher.findOne({ email }).select(
      "+passwordHash status mustChangePassword failedAttempts lockUntil"
    );

    if (!teacher) {
      await comparePassword(password, DUMMY_HASH);
      await recordIpFailure(email, req.ip);
      return next(invalidCredentials());
    }
    if (teacher.status !== "active") {
      await recordIpFailure(email, req.ip);
      return next(invalidCredentials());
    }
    // Same generic error when locked — do not reveal lockout.
    if (teacher.lockUntil && teacher.lockUntil > new Date()) return next(invalidCredentials());

    const ok = await comparePassword(password, teacher.passwordHash);
    if (!ok) {
      await recordFailedAttempt(teacher._id);
      await recordIpFailure(email, req.ip);
      await writeAudit({
        actor: teacher._id,
        actorType: "teacher",
        action: "login.failed",
        entity: "Teacher",
        entityId: teacher._id,
      });
      return next(invalidCredentials());
    }

    await Teacher.updateOne(
      { _id: teacher._id },
      { $set: { failedAttempts: 0, lockUntil: null } }
    );
    await clearIpFailures(email, req.ip);

    const roles = await getRoles(teacher._id);
    const accessToken = signTeacherAccess(teacher._id, roles);

    const raw = newRefreshToken();
    await RefreshToken.create({
      actor: teacher._id,
      actorType: "teacher",
      tokenHash: sha256(raw),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      ip: req.ip,
      expiresAt: new Date(Date.now() + REFRESH_MS),
      revoked: false,
    });

    res.cookie("refreshToken", raw, teacherRefreshCookieOptions);
    return res.json({ accessToken, roles, mustChangePassword: teacher.mustChangePassword });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate key";
    }
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.refreshToken;
    if (!raw) return next(invalidCredentials());
    const hash = sha256(raw);
    const now = new Date();

    // Atomic rotation: only an unrevoked, unexpired row can be claimed.
    const stored = await RefreshToken.findOneAndUpdate(
      { tokenHash: hash, actorType: "teacher", revoked: false, expiresAt: { $gt: now } },
      { $set: { revoked: true, revokedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!stored) {
      const prev = await RefreshToken.findOne({ tokenHash: hash, actorType: "teacher" });
      if (prev && prev.revoked) {
        const age = prev.revokedAt ? Date.now() - prev.revokedAt.getTime() : Infinity;
        // Concurrent retry within grace window — do not wipe sessions.
        if (age < REUSE_GRACE_MS) return next(invalidCredentials());
        await RefreshToken.updateMany(
          { actor: prev.actor, actorType: "teacher", revoked: false },
          { $set: { revoked: true, revokedAt: new Date() } }
        );
        await writeAudit({
          actor: prev.actor,
          actorType: "teacher",
          action: "refresh.reuse",
          entity: "RefreshToken",
          meta: {},
        });
      }
      return next(invalidCredentials());
    }

    const teacher = await Teacher.findById(stored.actor).select("status");
    if (!teacher || teacher.status !== "active") {
      return next(invalidCredentials());
    }

    const roles = await getRoles(teacher._id);
    const accessToken = signTeacherAccess(teacher._id, roles);

    const nextRaw = newRefreshToken();
    await RefreshToken.create({
      actor: teacher._id,
      actorType: "teacher",
      tokenHash: sha256(nextRaw),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      ip: req.ip,
      expiresAt: new Date(Date.now() + REFRESH_MS),
      revoked: false,
    });

    res.cookie("refreshToken", nextRaw, teacherRefreshCookieOptions);
    return res.json({ accessToken, roles });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const raw = req.cookies?.refreshToken;
    if (raw) {
      await RefreshToken.updateOne(
        { tokenHash: sha256(raw), actorType: "teacher" },
        { $set: { revoked: true, revokedAt: new Date() } }
      );
    }
    clearTeacherRefreshCookie(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    await RefreshToken.updateMany(
      { actor: new mongoose.Types.ObjectId(req.user.sub), actorType: "teacher", revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
    clearTeacherRefreshCookie(res);
    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "teacher",
      action: "logout.all",
      entity: "RefreshToken",
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const teacher = await Teacher.findById(req.user.sub).select(
      "+passwordHash status mustChangePassword"
    );
    if (!teacher || teacher.status !== "active") return next(invalidCredentials());

    const ok = await comparePassword(currentPassword, teacher.passwordHash);
    if (!ok) return next(invalidCredentials());

    teacher.passwordHash = await hashPassword(newPassword);
    teacher.mustChangePassword = false;
    teacher.failedAttempts = 0;
    teacher.lockUntil = null;
    await teacher.save();

    await RefreshToken.updateMany(
      { actor: teacher._id, actorType: "teacher", revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
    clearTeacherRefreshCookie(res);
    await writeAudit({
      actor: teacher._id,
      actorType: "teacher",
      action: "password.change",
      entity: "Teacher",
      entityId: teacher._id,
    });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate key";
    }
    return next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const teacher = await Teacher.findOne({ email }).select("_id status");
    // Generic response to prevent enumeration.
    if (teacher && teacher.status === "active") {
      // Invalidate older pending tokens before issuing a new one.
      await PasswordReset.updateMany(
        { teacher: teacher._id, used: false, expiresAt: { $gt: new Date() } },
        { $set: { used: true } }
      );
      const raw = newResetToken();
      try {
        await PasswordReset.create({
          teacher: teacher._id,
          tokenHash: sha256(raw),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          used: false,
        });
      } catch (e) {
        if (e.code === 11000) {
          e.status = 409;
          e.message = "Duplicate key";
        }
        throw e;
      }
      // TODO: send emailed link. Log raw token only outside production for testing.
      if (process.env.NODE_ENV !== "production") {
        logger.info(`Password reset token for ${email}: ${raw}`);
      }
      await writeAudit({
        actor: teacher._id,
        actorType: "teacher",
        action: "password.forgot",
        entity: "Teacher",
        entityId: teacher._id,
      });
    }
    return res.json({ ok: true, message: "If the email exists, a reset link was sent" });
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const record = await PasswordReset.findOne({ tokenHash: sha256(token), used: false });
    if (!record || record.expiresAt < new Date()) {
      const err = new Error("Invalid or expired token");
      err.status = 400;
      return next(err);
    }
    const teacher = await Teacher.findById(record.teacher).select("+passwordHash status");
    if (!teacher || teacher.status !== "active") {
      const err = new Error("Invalid or expired token");
      err.status = 400;
      return next(err);
    }
    teacher.passwordHash = await hashPassword(newPassword);
    teacher.mustChangePassword = false;
    teacher.failedAttempts = 0;
    teacher.lockUntil = null;
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
      action: "password.reset",
      entity: "Teacher",
      entityId: teacher._id,
    });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate key";
    }
    return next(err);
  }
}

export { login, refresh, logout, logoutAll, changePassword, forgotPassword, resetPassword };
