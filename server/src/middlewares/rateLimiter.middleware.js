import rateLimit from "express-rate-limit";

// Global: 100 reqs / 15 min per IP across all routes.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later." },
});

// Auth-only: apply per-route, e.g. app.use("/api/auth", authLimiter, authRoutes).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, try again later." },
});

export { limiter, authLimiter };
