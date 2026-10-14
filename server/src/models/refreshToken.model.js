import mongoose from "mongoose";

// One row per browser/device. Stores SHA-256 hash only — never the raw token.
const refreshTokenSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    actorType: { type: String, enum: ["teacher", "admin"], required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, maxlength: 512 },
    ip: { type: String, maxlength: 64 },
    expiresAt: { type: Date, required: true, index: true },
    revoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ actor: 1, actorType: 1, revoked: 1 });

export default mongoose.model("RefreshToken", refreshTokenSchema);
