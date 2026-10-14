import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import dns from "node:dns";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Local ISP DNS breaks Atlas SRV lookups — same fix as src/config/db.js.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

const username = String(process.argv[2] || "").trim().toLowerCase();
const password = String(process.argv[3] || "");

if (!username || !password) {
  console.error("Usage: node scripts/seed-admin.js <username> <password>");
  process.exit(1);
}
if (Buffer.byteLength(password, "utf8") > 72 || password.length < 8) {
  console.error("Password must be 8-72 chars and at most 72 bytes");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not set");
  process.exit(1);
}

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);
const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);

await mongoose.connect(process.env.MONGO_URI);
const exists = await Admin.findOne({ username }).lean();
if (exists) {
  console.error(`Admin '${username}' already exists`);
  await mongoose.disconnect();
  process.exit(1);
}
const passwordHash = await bcrypt.hash(password, 12);
await Admin.create({ username, passwordHash, permissions: [], isActive: true });
console.log(`Admin '${username}' seeded`);
await mongoose.disconnect();
process.exit(0);
