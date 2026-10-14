import jwt from "jsonwebtoken";

const TEACHER_EXPIRES = "15m";
const ADMIN_EXPIRES = "5m";
const TEACHER_AUD = "exsymation-teacher";
const ADMIN_AUD = "exsymation-admin";

function requireTeacherSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  return process.env.JWT_SECRET;
}

function requireAdminSecret() {
  if (!process.env.JWT_ADMIN_SECRET) throw new Error("JWT_ADMIN_SECRET is not set");
  return process.env.JWT_ADMIN_SECRET;
}

function assertSecretsDistinct() {
  if (
    process.env.JWT_SECRET &&
    process.env.JWT_ADMIN_SECRET &&
    process.env.JWT_SECRET === process.env.JWT_ADMIN_SECRET
  ) {
    throw new Error("JWT_SECRET and JWT_ADMIN_SECRET must differ");
  }
}

// Teacher payload: { sub, roles, type:'teacher', aud }. No email/PII.
function signTeacherAccess(sub, roles) {
  return jwt.sign({ sub: String(sub), roles, type: "teacher" }, requireTeacherSecret(), {
    expiresIn: TEACHER_EXPIRES,
    algorithm: "HS256",
    audience: TEACHER_AUD,
  });
}

function verifyTeacherAccess(token) {
  const payload = jwt.verify(token, requireTeacherSecret(), {
    algorithms: ["HS256"],
    audience: TEACHER_AUD,
  });
  if (payload.type !== "teacher") throw new Error("Not a teacher token");
  return payload;
}

// Admin payload: { sub, type:'admin', aud }. Separate secret, shorter session.
function signAdminAccess(sub) {
  return jwt.sign({ sub: String(sub), type: "admin" }, requireAdminSecret(), {
    expiresIn: ADMIN_EXPIRES,
    algorithm: "HS256",
    audience: ADMIN_AUD,
  });
}

function verifyAdminAccess(token) {
  const payload = jwt.verify(token, requireAdminSecret(), {
    algorithms: ["HS256"],
    audience: ADMIN_AUD,
  });
  if (payload.type !== "admin") throw new Error("Not an admin token");
  return payload;
}

export {
  signTeacherAccess,
  verifyTeacherAccess,
  signAdminAccess,
  verifyAdminAccess,
  assertSecretsDistinct,
};
