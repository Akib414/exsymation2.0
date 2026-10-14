import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_BYTES = 32;
const VERSION = "v1";

function getKey() {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || "", "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes as 64 hex chars");
  }
  return key;
}

// Format: v1:iv:authTag:ciphertext (all hex after prefix).
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return `${VERSION}:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

function decrypt(payload) {
  const parts = String(payload).split(":");
  // Accept legacy unprefixed payloads (iv:tag:data) and v1 (v1:iv:tag:data).
  let ivHex;
  let tagHex;
  let dataHex;
  if (parts.length === 4 && parts[0] === VERSION) {
    [, ivHex, tagHex, dataHex] = parts;
  } else if (parts.length === 3) {
    [ivHex, tagHex, dataHex] = parts;
  } else {
    throw new Error("Invalid encrypted payload format");
  }
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted payload format");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

export { encrypt, decrypt, VERSION };
