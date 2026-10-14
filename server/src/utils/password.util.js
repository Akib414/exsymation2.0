import bcrypt from "bcryptjs";

const COST = 12;
const MAX_BYTES = 72;

function assertPasswordSize(password) {
  if (Buffer.byteLength(String(password), "utf8") > MAX_BYTES) {
    const err = new Error("Password must be at most 72 bytes");
    err.status = 400;
    throw err;
  }
}

async function hashPassword(password) {
  assertPasswordSize(password);
  return bcrypt.hash(String(password), COST);
}

async function comparePassword(password, passwordHash) {
  if (!passwordHash) return false;
  try {
    return await bcrypt.compare(String(password), passwordHash);
  } catch {
    return false;
  }
}

export { hashPassword, comparePassword, COST, MAX_BYTES };
