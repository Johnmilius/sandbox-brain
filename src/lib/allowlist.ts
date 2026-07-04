/**
 * Email allowlist — only these Google accounts may use the app.
 * Configure via ALLOWED_EMAILS (comma-separated) in .env.local / Vercel.
 *
 * Note: this is the app-level gate. Phase 1 adds a database-level gate
 * via Row Level Security so data is protected even if this check is bypassed.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
