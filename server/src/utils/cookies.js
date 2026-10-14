// Refresh cookie defaults.
// COOKIE_SAMESITE: Strict (default) | Lax | None.
// COOKIE_DOMAIN: e.g. .example.com for shared frontend/API registrable domain.
// NOTE: frontend and API must share a registrable domain for Strict/Lax cookies.
// Cross-site deployments must use SameSite=None (requires Secure/HTTPS) plus CSRF protection.
function resolveSameSite() {
  const raw = String(process.env.COOKIE_SAMESITE || "Strict").toLowerCase();
  if (raw === "none") return "none";
  if (raw === "lax") return "lax";
  return "strict";
}

function resolveDomain() {
  const d = String(process.env.COOKIE_DOMAIN || "").trim();
  return d || undefined;
}

const isProd = process.env.NODE_ENV === "production";
const sameSite = resolveSameSite();
// SameSite=None requires Secure, even outside production.
const secure = sameSite === "none" ? true : isProd;
const domain = resolveDomain();

const teacherRefreshCookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
  ...(domain ? { domain } : {}),
};

const adminRefreshCookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  maxAge: 1 * 24 * 60 * 60 * 1000,
  path: "/api/admin",
  ...(domain ? { domain } : {}),
};

// Legacy generic cookie (kept for compatibility).
const authCookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
  ...(domain ? { domain } : {}),
};

function clearTeacherRefreshCookie(res) {
  res.clearCookie("refreshToken", { ...teacherRefreshCookieOptions, maxAge: undefined });
}

function clearAdminRefreshCookie(res) {
  res.clearCookie("adminRefresh", { ...adminRefreshCookieOptions, maxAge: undefined });
}

function clearAuthCookie(res, name = "token") {
  res.clearCookie(name, { ...authCookieOptions, maxAge: undefined });
}

export {
  authCookieOptions,
  clearAuthCookie,
  teacherRefreshCookieOptions,
  adminRefreshCookieOptions,
  clearTeacherRefreshCookie,
  clearAdminRefreshCookie,
};
