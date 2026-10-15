import { Router } from "express";

import { login, refresh, logout, logoutAll, changePassword } from "../controllers/admin.controller.js";
import {
  createTeacher,
  deactivateTeacher,
  reactivateTeacher,
  listTeachers,
} from "../controllers/teacher.controller.js";
import { createCourses, listCourses, updateCourse, deleteCourse } from "../controllers/course.controller.js";
import {
  addCourseToSemester,
  removeCourseFromSemester,
  getSemesterCourses,
} from "../controllers/semesterCourse.controller.js";
import { createBatch, listBatches, updateBatch } from "../controllers/session.controller.js";
import { changeChairman } from "../controllers/committee.controller.js";
import { protectAdmin } from "../middlewares/auth.middleware.js";
import { csrfCheck } from "../middlewares/csrf.middleware.js";
import { loginLimiter, refreshLimiter } from "../middlewares/rateLimiter.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { adminLoginSchema, changePasswordSchema } from "../validators/auth.validator.js";
import { teachersCreateUnion, chairmanChangeSchema } from "../validators/committee.validator.js";
import { coursesCreateUnion, courseUpdateSchema, semesterAddCourseSchema } from "../validators/course.validator.js";
import { sessionCreateSchema, sessionUpdateSchema } from "../validators/session.validator.js";

const router = Router();

// Admin-only login — no signup route. Credentials are seeded via scripts/seed-admin.js.
router.post("/login", loginLimiter, validate(adminLoginSchema), login);
router.post("/refresh", refreshLimiter, csrfCheck, refresh);
router.delete("/refresh", csrfCheck, logout);
router.post("/logout", csrfCheck, logout);
router.post("/logout-all", protectAdmin, logoutAll);
router.post("/change-password", protectAdmin, validate(changePasswordSchema), changePassword);

// Admin-only teacher profile management. Single OR bulk in one route.
router.post("/teachers", protectAdmin, validate(teachersCreateUnion), createTeacher);
router.get("/teachers", protectAdmin, listTeachers);
router.patch("/teachers/:id/deactivate", protectAdmin, deactivateTeacher);
router.patch("/teachers/:id/reactivate", protectAdmin, reactivateTeacher);

// Admin-only course management. Single object OR bulk 1-100 per request.
router.post("/courses", protectAdmin, validate(coursesCreateUnion), createCourses);
router.get("/courses", protectAdmin, listCourses);
router.patch("/courses/:id", protectAdmin, validate(courseUpdateSchema), updateCourse);
router.delete("/courses/:id", protectAdmin, deleteCourse);

// Semester workflow: select semester -> add/remove course in course_list.
router.post(
  "/semester-courses/courses",
  protectAdmin,
  validate(semesterAddCourseSchema),
  addCourseToSemester
);
router.delete(
  "/semester-courses/:semester/courses/:courseId",
  protectAdmin,
  removeCourseFromSemester
);
router.get("/semester-courses/:semester", protectAdmin, getSemesterCourses);

// Batch management: create + update only, no delete by design.
router.post("/batches", protectAdmin, validate(sessionCreateSchema), createBatch);
router.get("/batches", protectAdmin, listBatches);
router.patch("/batches/:id", protectAdmin, validate(sessionUpdateSchema), updateBatch);

// Chairman handover: current -> inactive, new teacher from Teacher table -> active.
router.post("/chairmen/change", protectAdmin, validate(chairmanChangeSchema), changeChairman);

export default router;
