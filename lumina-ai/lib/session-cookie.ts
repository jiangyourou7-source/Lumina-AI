export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "lumina_session";
export const SESSION_COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
export const SESSION_COOKIE_SAMESITE =
  process.env.SESSION_COOKIE_SAMESITE === "strict" || process.env.SESSION_COOKIE_SAMESITE === "none"
    ? process.env.SESSION_COOKIE_SAMESITE
    : "lax";
export const SESSION_COOKIE_MAX_AGE_SECONDS = Number(
  process.env.SESSION_COOKIE_MAX_AGE_SECONDS || 60 * 60 * 24 * 30
);

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAMESITE as "lax" | "strict" | "none",
    secure: SESSION_COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}
