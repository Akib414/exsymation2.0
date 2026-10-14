// CSRF guard for cookie-based refresh/logout when SameSite=None.
// Strict/Lax cookies are already CSRF-resistant; None requires an explicit check.
// Strategy: Origin (fallback Referer) must match the request host or FRONTEND_URL.
function sameSiteNone() {
  return String(process.env.COOKIE_SAMESITE || "Strict").toLowerCase() === "none";
}

function allowedOrigins(req) {
  const origins = new Set();
  const host = req.get("host");
  if (host) {
    origins.add(`https://${host}`);
    origins.add(`http://${host}`);
  }
  const front = String(process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  if (front) origins.add(front);
  return origins;
}

function csrfCheck(req, res, next) {
  if (!sameSiteNone()) return next();
  const origin = req.get("origin") || req.get("referer");
  if (!origin) {
    const err = new Error("CSRF check failed");
    err.status = 403;
    return next(err);
  }
  try {
    const originUrl = new URL(origin);
    const allowed = allowedOrigins(req);
    const ok = [...allowed].some((a) => {
      try {
        return new URL(a).origin === originUrl.origin;
      } catch {
        return false;
      }
    });
    if (!ok) {
      const err = new Error("CSRF check failed");
      err.status = 403;
      return next(err);
    }
    return next();
  } catch {
    const err = new Error("CSRF check failed");
    err.status = 403;
    return next(err);
  }
}

export { csrfCheck, sameSiteNone };
