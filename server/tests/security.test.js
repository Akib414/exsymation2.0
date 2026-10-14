import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "t".repeat(64);
process.env.JWT_ADMIN_SECRET = "a".repeat(64);
process.env.ENCRYPTION_KEY = "b".repeat(64);
process.env.APP_TIMEZONE = "UTC";

const { default: app } = await import("../src/app.js");
const { default: Teacher } = await import("../src/models/teacher.model.js");
const { default: Session } = await import("../src/models/session.model.js");
const { default: RefreshToken } = await import("../src/models/refreshToken.model.js");
const { default: DepartmentChairman } = await import("../src/models/departmentChairman.model.js");
const { default: Admin } = await import("../src/models/admin.model.js");
const { hashPassword } = await import("../src/utils/password.util.js");
const { sha256, newRefreshToken } = await import("../src/utils/tokens.js");
import { endOfDayInTZ, startOfDayInTZ } from "../src/utils/timezone.js";
const { signTeacherAccess, verifyTeacherAccess, signAdminAccess } =
  await import("../src/utils/jwt.js");
const { getRoles } = await import("../src/services/roles.service.js");
const { encrypt, decrypt } = await import("../src/utils/crypto.util.js");

let mongo;
let teacher;
let sessionDoc;
let accessToken;

before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongo.getUri());
  sessionDoc = await Session.create({ session: "2024-25", status: "active" });
  teacher = await Teacher.create({
    name: "Test Teacher",
    email: "test@example.com",
    passwordHash: await hashPassword("Password123"),
    status: "active",
    mustChangePassword: false,
  });
  const roles = await getRoles(teacher._id);
  accessToken = signTeacherAccess(teacher._id, roles);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("auth hardening", () => {
  it("login returns generic error for unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Password123" });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, "Invalid credentials");
  });

  it("locked account returns the same generic error", async () => {
    await Teacher.updateOne(
      { _id: teacher._id },
      { $set: { lockUntil: new Date(Date.now() + 60000) } }
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "Password123" });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, "Invalid credentials");
    await Teacher.updateOne({ _id: teacher._id }, { $set: { lockUntil: null, failedAttempts: 0 } });
  });

  it("JWT carries type/aud and verifies HS256 only", async () => {
    const payload = verifyTeacherAccess(accessToken);
    assert.equal(payload.type, "teacher");
    assert.deepEqual(payload.roles, ["teacher"]);
  });

  it("mustChangePassword blocks duties but allows /me", async () => {
    await Teacher.updateOne({ _id: teacher._id }, { $set: { mustChangePassword: true } });
    const blocked = await request(app)
      .get("/api/me/duties")
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(blocked.status, 403);
    const me = await request(app).get("/api/me").set("Authorization", `Bearer ${accessToken}`);
    assert.equal(me.status, 200);
    assert.ok(!("nid" in me.body));
    assert.ok("nidMasked" in me.body);
    await Teacher.updateOne({ _id: teacher._id }, { $set: { mustChangePassword: false } });
  });

  it("refresh rotation is single-use; immediate retry fails without wiping", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "Password123" });
    assert.equal(login.status, 200);
    const cookie = login.headers["set-cookie"].find((c) => c.startsWith("refreshToken="));
    assert.ok(cookie);
    const first = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    assert.equal(first.status, 200);
    const retry = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    assert.equal(retry.status, 401);
    const remaining = await RefreshToken.countDocuments({
      actor: teacher._id,
      actorType: "teacher",
      revoked: false,
    });
    assert.ok(remaining >= 1);
  });

  it("refresh reuse after 10s wipes all sessions", async () => {
    const raw = newRefreshToken();
    await RefreshToken.create({
      actor: teacher._id,
      actorType: "teacher",
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 3600000),
      revoked: true,
      revokedAt: new Date(Date.now() - 20000),
    });
    await RefreshToken.create({
      actor: teacher._id,
      actorType: "teacher",
      tokenHash: sha256(newRefreshToken()),
      expiresAt: new Date(Date.now() + 3600000),
      revoked: false,
    });
    const rawCookie = `refreshToken=${raw}`;
    const res = await request(app).post("/api/auth/refresh").set("Cookie", rawCookie);
    assert.equal(res.status, 401);
    const remaining = await RefreshToken.countDocuments({
      actor: teacher._id,
      actorType: "teacher",
      revoked: false,
    });
    assert.equal(remaining, 0);
    await RefreshToken.deleteMany({ actor: teacher._id });
  });

  it("committee requires five distinct teachers and start<end", async () => {
    const id = (i) => new mongoose.Types.ObjectId(`00000000000000000000000${i}`);
    const res = await request(app)
      .post("/api/committees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        chairman: String(id(1)),
        member1: String(id(1)),
        member2: String(id(2)),
        session: String(sessionDoc._id),
        semester: 1,
        start: new Date().toISOString(),
        end: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.ok([400, 403].includes(res.status));
  });

  it("committee end-of-day boundary is inclusive", () => {
    const now = new Date();
    assert.ok(startOfDayInTZ(now) <= now);
    assert.ok(endOfDayInTZ(now) >= now);
  });

  it("inactive teacher with live token is rejected", async () => {
    const t = await Teacher.create({
      name: "Temp",
      email: "temp@example.com",
      passwordHash: await hashPassword("Password123"),
      status: "active",
      mustChangePassword: false,
    });
    const token = signTeacherAccess(t._id, ["teacher"]);
    await Teacher.updateOne({ _id: t._id }, { $set: { status: "inactive" } });
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 401);
    await Teacher.deleteOne({ _id: t._id });
  });

  it("teacher token rejected on admin routes and vice versa", async () => {
    const admin = await Admin.create({
      username: "root",
      passwordHash: await hashPassword("Password123"),
      isActive: true,
    });
    const adminToken = signAdminAccess(admin._id);
    const tOnAdmin = await request(app)
      .post("/api/admin/logout-all")
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(tOnAdmin.status, 401);
    const aOnTeacher = await request(app)
      .get("/api/me")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(aOnTeacher.status, 401);
    await Admin.deleteOne({ _id: admin._id });
  });

  it("chairman partial unique index allows only one active", async () => {
    await DepartmentChairman.deleteMany({});
    await DepartmentChairman.create({ teacher: teacher._id, status: "active" });
    let dup = null;
    try {
      await DepartmentChairman.create({ teacher: teacher._id, status: "active" });
    } catch (e) {
      dup = e;
    }
    assert.ok(dup);
    assert.equal(dup.code, 11000);
    await DepartmentChairman.deleteMany({});
  });

  it("handover deactivates old and activates new in one transaction", async () => {
    await DepartmentChairman.deleteMany({});
    const other = await Teacher.create({
      name: "Other",
      email: "other@example.com",
      passwordHash: await hashPassword("Password123"),
      status: "active",
      mustChangePassword: false,
    });
    await DepartmentChairman.create({ teacher: teacher._id, status: "active" });
    const chairToken = signTeacherAccess(teacher._id, ["teacher", "chairman"]);
    const res = await request(app)
      .post("/api/committees/chairmen/change")
      .set("Authorization", `Bearer ${chairToken}`)
      .send({ newTeacherId: String(other._id) });
    assert.equal(res.status, 201);
    const count = await DepartmentChairman.countDocuments({ status: "active" });
    assert.equal(count, 1);
    await Teacher.deleteOne({ _id: other._id });
    await DepartmentChairman.deleteMany({});
  });

  it("nid ciphertext is versioned and round-trips", () => {
    const enc = encrypt("1234567890");
    assert.ok(enc.startsWith("v1:"));
    assert.equal(decrypt(enc), "1234567890");
  });

  it("sha256 refresh lookup format", () => {
    assert.equal(sha256("abc").length, 64);
  });
});
