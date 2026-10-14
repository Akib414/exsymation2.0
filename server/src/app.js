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
import teacherRoutes from "./routes/teacher.routes.js";
import examRoutes from "./routes/exam.routes.js";
import committeeRoutes from "./routes/committee.routes.js";
import routineRoutes from "./routes/routine.routes.js";
import proceedingsRoutes from "./routes/proceedings.routes.js";
import remunerationRoutes from "./routes/remuneration.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

// Behind nginx/Docker — needed for correct req.ip (rate limiter) and secure cookies.
app.set("trust proxy", 1);

app.use(helmet());
// Permissive until frontend URL is known — then restrict via FRONTEND_URL.
app.use(cors());
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
