import mongoose from "mongoose";

import Session from "../models/session.model.js";
import { writeAudit } from "../utils/audit.js";
import { cleanObject } from "../utils/sanitize.js";

function toOut(d) {
  return {
    id: String(d._id),
    session: d.session,
    batch: d.batch,
    current_semester: d.current_semester,
    status: d.status,
    student_number: d.student_number,
  };
}

// POST /api/admin/batches — admin only. No delete route exists by design.
async function createBatch(req, res, next) {
  try {
    const cleaned = cleanObject(req.body);
    const exists = await Session.findOne({ session: cleaned.session, batch: cleaned.batch })
      .select("_id")
      .lean();
    if (exists) {
      const err = new Error("Batch already exists for this session");
      err.status = 409;
      return next(err);
    }
    const doc = await Session.create(cleaned);
    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: "batch.create",
      entity: "Session",
      entityId: doc._id,
      meta: { session: doc.session, batch: doc.batch },
    });
    return res.status(201).json(toOut(doc));
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate batch";
    }
    return next(err);
  }
}

// GET /api/admin/batches — admin only.
async function listBatches(req, res, next) {
  try {
    const docs = await Session.find({}).sort({ session: 1, batch: 1 }).lean();
    return res.json({ count: docs.length, batches: docs.map(toOut) });
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/admin/batches/:id — admin only. Update only, never delete.
async function updateBatch(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error("Invalid id");
      err.status = 400;
      return next(err);
    }
    const cleaned = cleanObject(req.body);
    const doc = await Session.findByIdAndUpdate(
      id,
      { $set: cleaned },
      { new: true, runValidators: true }
    );
    if (!doc) {
      const err = new Error("Not found");
      err.status = 404;
      return next(err);
    }
    await writeAudit({
      actor: new mongoose.Types.ObjectId(req.user.sub),
      actorType: "admin",
      action: "batch.update",
      entity: "Session",
      entityId: doc._id,
      meta: { updated: Object.keys(cleaned) },
    });
    return res.json(toOut(doc));
  } catch (err) {
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Duplicate batch";
    }
    return next(err);
  }
}

export { createBatch, listBatches, updateBatch };
