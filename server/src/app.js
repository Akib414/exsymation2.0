import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoSanitize from "./middlewares/mongoSanitize.middleware.js";
import hppSafe from "./middlewares/hpp.middleware.js";

import logger from "./utils/logger.js";
import { limiter } from "./middlewares/rateLimiter.middleware.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import meRoutes from "./routes/me.routes.js";
import chairmanRoutes from "./routes/chairman.routes.js";
import chairmanCommitteeRoutes from "./routes/chairmanCommittee.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import examRoutes from "./routes/exam.routes.js";
import committeeRoutes from "./routes/committee.routes.js";
import routineRoutes from "./routes/routine.routes.js";
import proceedingsRoutes from "./routes/proceedings.routes.js";
import remunerationRoutes from "./routes/remuneration.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

// Trust proxy hops via env (rate limiter + secure cookies behind nginx).
// Set TRUST_PROXY=1 in Docker/nginx, higher if behind extra LB.
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));

app.use(helmet());
// CORS with credentials so the login page can use httpOnly refresh cookies.
// Set FRONTEND_URL in production; falls back to reflecting the origin in dev.
app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(mongoSanitize);
// Collapse duplicated query params to a single value.
app.use(hppSafe);
app.use(morgan("combined", { stream: logger.stream }));

app.use(limiter);

app.get("/", (req, res) => {
  res.send("Exsymation 2.0 is running!");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/me", meRoutes);
app.use("/api/chairman/committees", chairmanCommitteeRoutes);
app.use("/api/chairman", chairmanRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/committees", committeeRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/proceedings", proceedingsRoutes);
app.use("/api/remunerations", remunerationRoutes);
app.use("/api/notifications", notificationRoutes);

// Must stay after all routes.
app.use(notFound);

// Must stay last.
app.use(errorHandler);

export default app;
