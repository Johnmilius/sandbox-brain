/**
 * Post-sign-in redirect targets.
 *
 * The OAuth callback takes its landing path from the `next` query parameter,
 * which is attacker-reachable: anything that ends up concatenated onto the
 * deployment origin has to be a same-site path, or the redirect can leave the
 * site entirely.
 *
 * Accepts only a single-slash-rooted relative path ("/", "/notes/abc?x=1").
 * Everything else — absolute URLs, scheme-relative paths, anything the URL
 * parser could read as an authority — falls back to "/".
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  // Must be rooted, and the character after the root must not start an
  // authority. `\` is covered because the WHATWG parser folds it to `/`.
  if (raw[0] !== "/") return "/";
  if (raw[1] === "/" || raw[1] === "\\") return "/";
  return raw;
}
