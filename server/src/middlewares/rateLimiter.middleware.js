import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// Global: 100 reqs / 15 min per IP across all routes.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later." },
});

// Login: keyed by IP + email to stop credential stuffing against one account
// without locking out unrelated users behind the same NAT.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.toLowerCase().trim()
        : typeof req.body?.username === "string"
          ? req.body.username.toLowerCase().trim()
          : "";
    return `${ipKeyGenerator(req.ip)}:${email}`;
  },
  message: { error: "Too many login attempts, try again later." },
});

// Auth-only fallback (forgot/reset): per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, try again later." },
});

// Refresh: more generous — silent refresh fires often with in-memory tokens.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many refresh attempts, try again later." },
});

export { limiter, loginLimiter, authLimiter, refreshLimiter };
