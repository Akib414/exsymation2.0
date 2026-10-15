import { z } from "zod";

const sessionCreateSchema = z.object({
  session: z.string().trim().min(1).max(32),
  batch: z.string().trim().min(1).max(32),
  student_number: z.number().int().min(0),
  current_semester: z.number().int().min(1).max(10).optional().default(1),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

const sessionUpdateSchema = z
  .object({
    session: z.string().trim().min(1).max(32).optional(),
    batch: z.string().trim().min(1).max(32).optional(),
    student_number: z.number().int().min(0).optional(),
    current_semester: z.number().int().min(1).max(10).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Empty update" });

export { sessionCreateSchema, sessionUpdateSchema };
