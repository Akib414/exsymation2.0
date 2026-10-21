import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// The committee record stores no free-text name, description, or exam links:
// the identifier is derived from the batch and semester, and the end date
// falls back to one month after the formation date when it is not supplied.
const createChairmanCommitteeSchema = z.object({
  chairman: objectId,
  member1: objectId,
  member2: objectId,
  session: objectId,
  semester: z.number().int().min(1).max(10),
  start: z.string().datetime(),
  end: z.string().datetime().optional(),
});

export { createChairmanCommitteeSchema };
