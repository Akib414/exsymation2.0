import crypto from "crypto";

function newRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function newResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export { newRefreshToken, newResetToken, sha256 };
