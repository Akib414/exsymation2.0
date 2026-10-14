import AuditLog from "../models/auditLog.model.js";
import logger from "./logger.js";

async function writeAudit({ actor, actorType, action, entity, entityId, meta }) {
  try {
    await AuditLog.create({ actor, actorType, action, entity, entityId, meta });
  } catch (err) {
    logger.error({ message: "Audit write failed", error: err.message, action });
  }
}

export { writeAudit };
