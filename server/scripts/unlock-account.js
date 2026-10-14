import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import dns from "node:dns";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Local ISP DNS breaks Atlas SRV lookups — same fix as src/config/db.js.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

// Usage: node scripts/unlock-account.js <email|username>
// Clears account-wide lock and per-IP attempts for teachers and admins.
const identifier = String(process.argv[2] || "").trim().toLowerCase();
if (!identifier) {
  console.error("Usage: node scripts/unlock-account.js <email|username>");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not set");
  process.exit(1);
}

const teacherSchema = new mongoose.Schema(
  { email: String, failedAttempts: Number, lockUntil: Date },
  { timestamps: false }
);
const adminSchema = new mongoose.Schema(
  { username: String, failedAttempts: Number, lockUntil: Date },
  { timestamps: false }
);
const attemptSchema = new mongoose.Schema({ key: String }, { timestamps: false });

const Teacher = mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema);
const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
const LoginAttempt =
  mongoose.models.LoginAttempt || mongoose.model("LoginAttempt", attemptSchema);

await mongoose.connect(process.env.MONGO_URI);
const t = await Teacher.updateOne(
  { email: identifier },
  { $set: { failedAttempts: 0, lockUntil: null } }
);
const a = await Admin.updateOne(
  { username: identifier },
  { $set: { failedAttempts: 0, lockUntil: null } }
);
const ips = await LoginAttempt.deleteMany({ identifier });
console.log(
  `Unlocked '${identifier}': teachers=${t.modifiedCount} admins=${a.modifiedCount} ipRows=${ips.deletedCount}`
);
await mongoose.disconnect();
process.exit(0);
