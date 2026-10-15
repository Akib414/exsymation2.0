import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

const courseCreateSchema = z.object({
  course_code: z.string().trim().min(1).max(32),
  course_name: z.string().trim().min(1).max(200),
  course_type: z.enum(["Theory", "Lab", "Viva-Voce"]),
  course_credit: z.number().min(0).max(10),
});

const coursesBulkSchema = z.object({
  courses: z.array(courseCreateSchema).min(1).max(100),
});

// Single object OR { courses: [...] } — supports one or many in one route.
const coursesCreateUnion = z.union([courseCreateSchema, coursesBulkSchema]);

const courseUpdateSchema = z
  .object({
    course_code: z.string().trim().min(1).max(32).optional(),
    course_name: z.string().trim().min(1).max(200).optional(),
    course_type: z.enum(["Theory", "Lab", "Viva-Voce"]).optional(),
    course_credit: z.number().min(0).max(10).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Empty update" });

const semesterAddCourseSchema = z
  .object({
    semester: z.number().int().min(1).max(10),
    courseId: objectId.optional(),
    course_code: z.string().trim().min(1).max(32).optional(),
  })
  .refine((o) => o.courseId || o.course_code, { message: "courseId or course_code required" });

export { courseCreateSchema, coursesBulkSchema, coursesCreateUnion, courseUpdateSchema, semesterAddCourseSchema };
