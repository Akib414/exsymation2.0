import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const externalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  institution: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
});

const committeeCreateSchema = z.object({
  chairman: objectId,
  member1: objectId,
  member2: objectId,
  tabulator1: objectId.optional(),
  tabulator2: objectId.optional(),
  external: externalSchema.optional(),
  session: objectId,
  semester: z.number().int().min(1).max(10),
  start: z.string().datetime(),
  end: z.string().datetime(),
  status: z.enum(["active", "inactive"]).optional(),
});

const committeeUpdateSchema = committeeCreateSchema
  .partial()
  .extend({
    // Explicit null clears an optional slot/external member on update.
    tabulator1: objectId.nullable().optional(),
    tabulator2: objectId.nullable().optional(),
    external: externalSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const chairmanChangeSchema = z.object({
  newTeacherId: objectId,
});

const teacherCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(20).optional(),
  nid: z.string().max(100).optional(),
  photo: z.string().max(1024).optional(),
  tempPassword: z.string().min(8).max(72),
});

const teachersBulkSchema = z.object({
  teachers: z.array(teacherCreateSchema).min(1).max(100),
});

// Single object OR { teachers: [...] } — supports one or many in one route.
const teachersCreateUnion = z.union([teacherCreateSchema, teachersBulkSchema]);

export {
  committeeCreateSchema,
  committeeUpdateSchema,
  chairmanChangeSchema,
  teacherCreateSchema,
  teachersBulkSchema,
  teachersCreateUnion,
};
