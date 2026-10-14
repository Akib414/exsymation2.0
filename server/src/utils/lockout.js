import LoginAttempt from "../models/loginAttempt.model.js";

const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;
const MAX_IP_ATTEMPTS = 10;

function delayFor(excess) {
  const capped = Math.min(Math.max(excess, 0), 2);
  return Math.min(BASE_LOCK_MS * 2 ** capped, MAX_LOCK_MS);
}

function keyFor(identifier, ip) {
  return `${String(identifier).toLowerCase().trim()}|${String(ip)}`;
}

async function checkIpLock(identifier, ip) {
  if (!identifier) return false;
  const row = await LoginAttempt.findOne({ key: keyFor(identifier, ip) })
    .select("lockUntil")
    .lean();
  return Boolean(row && row.lockUntil && row.lockUntil > new Date());
}

async function recordIpFailure(identifier, ip) {
  if (!identifier) return;
  const key = keyFor(identifier, ip);
  await LoginAttempt.updateOne(
    { key },
    { $setOnInsert: { identifier: String(identifier).toLowerCase().trim(), ip: String(ip) } },
    { upsert: true }
  );
  await LoginAttempt.updateOne({ key }, { $inc: { attempts: 1 } });
  const fresh = await LoginAttempt.findOne({ key }).select("attempts").lean();
  if (fresh && fresh.attempts >= MAX_IP_ATTEMPTS) {
    const excess = fresh.attempts - MAX_IP_ATTEMPTS;
    await LoginAttempt.updateOne(
      { key },
      { $set: { lockUntil: new Date(Date.now() + delayFor(excess)) } }
    );
  }
}

async function clearIpFailures(identifier, ip) {
  if (!identifier) return;
  await LoginAttempt.deleteOne({ key: keyFor(identifier, ip) });
}

export { checkIpLock, recordIpFailure, clearIpFailures, delayFor, MAX_LOCK_MS, BASE_LOCK_MS };
