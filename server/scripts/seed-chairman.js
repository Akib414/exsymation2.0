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

// Usage: node scripts/seed-chairman.js "<name>" <email> <tempPassword> [phone]
// Bootstraps the system: creates the first active Teacher + active DepartmentChairman.
const name = String(process.argv[2] || "").trim();
const email = String(process.argv[3] || "").trim().toLowerCase();
const tempPassword = String(process.argv[4] || "");
const phone = String(process.argv[5] || "").trim();

if (!name || !email || !tempPassword) {
  console.error("Usage: node scripts/seed-chairman.js \"<name>\" <email> <tempPassword> [phone]");
  process.exit(1);
}
if (Buffer.byteLength(tempPassword, "utf8") > 72 || tempPassword.length < 8) {
  console.error("tempPassword must be 8-72 chars and at most 72 bytes");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not set");
  process.exit(1);
}

const teacherSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    nid: { type: String, select: false },
    photo: String,
    passwordHash: { type: String, select: false },
    status: String,
    mustChangePassword: Boolean,
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);
const chairmanSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    status: String,
    startDate: Date,
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

const Teacher = mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema);
const DepartmentChairman =
  mongoose.models.DepartmentChairman || mongoose.model("DepartmentChairman", chairmanSchema);

await mongoose.connect(process.env.MONGO_URI);

const existingChair = await DepartmentChairman.findOne({ status: "active" }).lean();
if (existingChair) {
  console.error("An active chairman already exists — refusing to seed another");
  await mongoose.disconnect();
  process.exit(1);
}
const existingTeacher = await Teacher.findOne({ email }).lean();
if (existingTeacher) {
  console.error(`Teacher '${email}' already exists`);
  await mongoose.disconnect();
  process.exit(1);
}

const passwordHash = await bcrypt.hash(tempPassword, 12);
const teacher = await Teacher.create({
  name,
  email,
  phone: phone || undefined,
  passwordHash,
  status: "active",
  mustChangePassword: true,
  failedAttempts: 0,
  lockUntil: null,
});
await DepartmentChairman.create({ teacher: teacher._id, status: "active", startDate: new Date() });
console.log(`Chairman seeded: ${teacher._id} (${email}) — mustChangePassword=true`);
await mongoose.disconnect();
process.exit(0);
