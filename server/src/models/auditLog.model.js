import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, index: true },
    actorType: { type: String, enum: ["teacher", "admin"], required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 100, index: true },
    entity: { type: String, trim: true, maxlength: 100 },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
