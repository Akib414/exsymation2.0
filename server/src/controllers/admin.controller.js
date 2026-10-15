import mongoose from "mongoose";

import Admin from "../models/admin.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import { signAdminAccess } from "../utils/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.util.js";
import { newRefreshToken, sha256 } from "../utils/tokens.js";
import { adminRefreshCookieOptions, clearAdminRefreshCookie } from "../utils/cookies.js";
import { writeAudit } from "../utils/audit.js";
import { checkIpLock, recordIpFailure, clearIpFailures } from "../utils/lockout.js";

const MAX_FAILED = 20;
const LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;
const REFRESH_MS = 1 * 24 * 60 * 60 * 1000;
const REUSE_GRACE_MS = 10 * 1000;
const DUMMY_HASH = "$2b$12$pwQgcGrdsxxHSluvKRImw.n9/sTuC0SpOpgtE78l7ioUUPoKcYgxu";

function invalid() {
  const err = new Error("Invalid credentials");
  err.status = 401;
  return err;
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (Buffer.byteLength(String(password), "utf8") > 72) return next(invalid());
    if (await checkIpLock(username, req.ip)) return next(invalid());
    const admin = await Admin.findOne({ username }).select(
      "+passwordHash isActive failedAttempts lockUntil"
    );
    if (!admin) {
      await comparePassword(password, DUMMY_HASH);
      await recordIpFailure(username, req.ip);
      return next(invalid());
    }
    if (!admin.isActive) {
      await recordIpFailure(username, req.ip);
      return next(invalid());
    }
    if (admin.lockUntil && admin.lockUntil > new Date()) return next(invalid());

    const ok = await comparePassword(password, admin.passwordHash);
    if (!ok) {
      await Admin.updateOne({ _id: admin._id }, { $inc: { failedAttempts: 1 } });
      const fresh = await Admin.findById(admin._id).select("failedAttempts").lean();
      if (fresh && fresh.failedAttempts >= MAX_FAILED) {
        const excess = Math.min(fresh.failedAttempts - MAX_FAILED, 2);
        const delay = Math.min(LOCK_MS * 2 ** excess, MAX_LOCK_MS);
        await Admin.updateOne(
          { _id: admin._id },
          { $set: { lockUntil: new Date(Date.now() + delay) } }
        );
      }
      await recordIpFailure(username, req.ip);
      await writeAudit({ actor: admin._id, actorType: "admin", action: "login.failed" });
      return next(invalid());
    }

    await Admin.updateOne({ _id: admin._id }, { $set: { failedAttempts: 0, lockUntil: null } });
    await clearIpFailures(username, req.ip);

    const accessToken = signAdminAccess(admin._id);
    const raw = newRefreshToken();
    await RefreshToken.create({
      actor: admin._id,
      actorType: "admin",
      tokenHash: sha256(raw),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      ip: req.ip,
      expiresAt: new Date(Date.now() + REFRESH_MS),
      revoked: false,
    });

    res.cookie("adminRefresh", raw, adminRefreshCookieOptions);
    return res.json({ accessToken, type: "admin" });
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const raw = req.cookies?.adminRefresh;
    if (!raw) return next(invalid());
    const hash = sha256(raw);
    const now = new Date();

    const stored = await RefreshToken.findOneAndUpdate(
      { tokenHash: hash, actorType: "admin", revoked: false, expiresAt: { $gt: now } },
      { $set: { revoked: true, revokedAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!stored) {
      const prev = await RefreshToken.findOne({ tokenHash: hash, actorType: "admin" });
      if (prev && prev.revoked) {
        const age = prev.revokedAt ? Date.now() - prev.revokedAt.getTime() : Infinity;
        if (age < REUSE_GRACE_MS) return next(invalid());
        await RefreshToken.updateMany(
          { actor: prev.actor, actorType: "admin", revoked: false },
          { $set: { revoked: true, revokedAt: new Date() } }
        );
        await writeAudit({ actor: prev.actor, actorType: "admin", action: "refresh.reuse" });
      }
      return next(invalid());
    }

    const admin = await Admin.findById(stored.actor).select("isActive");
    if (!admin || !admin.isActive) return next(invalid());

    const accessToken = signAdminAccess(admin._id);
    const nextRaw = newRefreshToken();
    await RefreshToken.create({
      actor: admin._id,
      actorType: "admin",
      tokenHash: sha256(nextRaw),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 512),
      ip: req.ip,
      expiresAt: new Date(Date.now() + REFRESH_MS),
      revoked: false,
    });

    res.cookie("adminRefresh", nextRaw, adminRefreshCookieOptions);
    return res.json({ accessToken, type: "admin" });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const raw = req.cookies?.adminRefresh;
    if (raw) {
      await RefreshToken.updateOne(
        { tokenHash: sha256(raw), actorType: "admin" },
        { $set: { revoked: true, revokedAt: new Date() } }
      );
    }
    clearAdminRefreshCookie(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    await RefreshToken.updateMany(
      { actor: new mongoose.Types.ObjectId(req.user.sub), actorType: "admin", revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
    clearAdminRefreshCookie(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.user.sub).select(
      "+passwordHash isActive failedAttempts lockUntil"
    );
    if (!admin || !admin.isActive) return next(invalid());

    const ok = await comparePassword(currentPassword, admin.passwordHash);
    if (!ok) return next(invalid());

    admin.passwordHash = await hashPassword(newPassword);
    admin.failedAttempts = 0;
    admin.lockUntil = null;
    await admin.save();

    await RefreshToken.updateMany(
      { actor: admin._id, actorType: "admin", revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
    clearAdminRefreshCookie(res);
    await writeAudit({
      actor: admin._id,
      actorType: "admin",
      action: "password.change",
      entity: "Admin",
      entityId: admin._id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export { login, refresh, logout, logoutAll, changePassword };
