// Secure cookie defaults for auth tokens (use in login/logout controllers).
const isProd = process.env.NODE_ENV === "production";

const authCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

function clearAuthCookie(res, name = "token") {
  res.clearCookie(name, { ...authCookieOptions, maxAge: undefined });
}

export { authCookieOptions, clearAuthCookie };
