/**
 * Shared context: environment, Supabase client, actor identity, and
 * common resolvers used by every tool.
 *
 * Two auth modes (see mcp/README.md):
 *
 *   user (preferred) — BRAIN_USER_REFRESH_TOKEN + the anon key. The server
 *     signs in as the actual team member, so every query runs as
 *     `authenticated` and all row-level-security policies stay in force. The
 *     acting identity falls out of the session; no BRAIN_ACTOR_EMAIL needed.
 *     The server keeps the rotated refresh token written back to .env.local.
 *
 *   service (legacy) — SUPABASE_SERVICE_ROLE_KEY + BRAIN_ACTOR_EMAIL. Bypasses
 *     RLS entirely; kept only so existing setups don't break. Warns on start.
 *
 * Env vars (from the MCP client config, with ../.env.local as fallback):
 *   SUPABASE_URL                (falls back to NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_ANON_KEY           (falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *   BRAIN_USER_REFRESH_TOKEN    per-user token from the web app (user mode)
 *   SUPABASE_SERVICE_ROLE_KEY   secret; legacy service mode only
 *   BRAIN_ACTOR_EMAIL           acting identity; legacy service mode only
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Path of the .env.local we actually read, so we can write rotated tokens back. */
let envFilePath: string | null = null;

/** Minimal .env parser so teammates only maintain the repo's .env.local. */
function loadEnvFileFallback(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const candidate of [
    join(HERE, "..", "..", ".env.local"), // running from mcp/dist
    join(HERE, "..", ".env.local"),
  ]) {
    try {
      const text = readFileSync(candidate, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
      envFilePath = candidate;
      break;
    } catch {
      // try next candidate
    }
  }
  return result;
}

const fileEnv = loadEnvFileFallback();

function env(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name] ?? fileEnv[name];
    if (value) return value;
  }
  return undefined;
}

export const SUPABASE_URL = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
export const ANON_KEY = env("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
export const USER_REFRESH_TOKEN = env("BRAIN_USER_REFRESH_TOKEN");
export const ACTOR_EMAIL = env("BRAIN_ACTOR_EMAIL")?.toLowerCase();

export type AuthMode = "user" | "service";

/** A refresh token means "act as that user"; otherwise fall back to the key. */
export const AUTH_MODE: AuthMode = USER_REFRESH_TOKEN ? "user" : "service";

/** Only write rotated tokens back when the token came from the file we own. */
const TOKEN_FROM_FILE =
  !process.env.BRAIN_USER_REFRESH_TOKEN && Boolean(fileEnv.BRAIN_USER_REFRESH_TOKEN);

export function assertConfigured(): string | null {
  if (!SUPABASE_URL) {
    return (
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). " +
      "Set it in the MCP client config env, or in the repo's .env.local."
    );
  }

  if (AUTH_MODE === "user") {
    if (!ANON_KEY) {
      return (
        "Missing SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY), which " +
        "per-user auth needs. It's under Supabase -> Settings -> API."
      );
    }
    return null;
  }

  const missing: string[] = [];
  if (!SERVICE_ROLE_KEY) {
    missing.push("BRAIN_USER_REFRESH_TOKEN (preferred) or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!ACTOR_EMAIL) missing.push("BRAIN_ACTOR_EMAIL (service mode only)");
  if (missing.length === 0) return null;
  return (
    `Missing configuration: ${missing.join(", ")}. ` +
    "See mcp/README.md — the per-user token comes from the web app (Profile -> MCP access)."
  );
}

let client: SupabaseClient | null = null;

/** The authenticated client. Only valid after initAuth() has run. */
export function supabase(): SupabaseClient {
  if (!client) {
    throw new Error("Supabase client used before initAuth() — this is a bug.");
  }
  return client;
}

export type Actor = { id: string; email: string; name: string | null };

let actorCache: Actor | null = null;
let lastPersistedToken: string | null = null;

/** Keep .env.local's refresh token current so restarts still authenticate. */
function persistRotatedToken(token: string | undefined): void {
  if (!token || token === lastPersistedToken) return;
  lastPersistedToken = token;
  if (!TOKEN_FROM_FILE || !envFilePath) return;
  try {
    const text = readFileSync(envFilePath, "utf8");
    const line = `BRAIN_USER_REFRESH_TOKEN=${token}`;
    const next = /^\s*BRAIN_USER_REFRESH_TOKEN\s*=.*$/m.test(text)
      ? text.replace(/^\s*BRAIN_USER_REFRESH_TOKEN\s*=.*$/m, line)
      : `${text.replace(/\s*$/, "")}\n${line}\n`;
    writeFileSync(envFilePath, next);
  } catch {
    console.error(
      "sandbox-brain-mcp-server: couldn't write the rotated refresh token back to " +
        ".env.local. If a later restart fails to authenticate, grab a fresh token " +
        "from the web app (Profile -> MCP access).",
    );
  }
}

/**
 * Sign in and resolve the acting team member. Must run once before any tool.
 *
 * In user mode the client becomes `authenticated`, so RLS protects every
 * query and attribution comes from the session. In service mode the key
 * bypasses RLS, so writes must still stamp user/author columns to the actor.
 */
export async function initAuth(): Promise<void> {
  if (AUTH_MODE === "user") {
    client = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: true },
    });

    const { data, error } = await client.auth.refreshSession({
      refresh_token: USER_REFRESH_TOKEN!,
    });
    if (error || !data.session) {
      throw new Error(
        `Couldn't sign in with BRAIN_USER_REFRESH_TOKEN: ${error?.message ?? "no session returned"}. ` +
          "The token likely expired — grab a fresh one from the web app (Profile -> MCP access) " +
          "and update .env.local.",
      );
    }

    persistRotatedToken(data.session.refresh_token);
    client.auth.onAuthStateChange((_event, session) =>
      persistRotatedToken(session?.refresh_token),
    );

    const user = data.session.user;
    const { data: profile } = await client
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", user.id)
      .maybeSingle();
    actorCache = {
      id: user.id,
      email: profile?.email ?? user.email ?? "",
      name: profile?.full_name ?? null,
    };
    return;
  }

  // Legacy service-role mode.
  console.error(
    "sandbox-brain-mcp-server: authenticating with the service-role key (legacy mode). " +
      "This bypasses row-level security. Consider switching to per-user auth with " +
      "BRAIN_USER_REFRESH_TOKEN — see mcp/README.md.",
  );
  client = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", ACTOR_EMAIL!)
    .maybeSingle();
  if (error) throw new Error(`Couldn't look up your profile: ${error.message}`);
  if (!data) {
    throw new Error(
      `No profile found for ${ACTOR_EMAIL}. Sign in to the Sandbox Brain web app ` +
        "once with that Google account first (and make sure the email is in allowed_emails).",
    );
  }
  actorCache = { id: data.id, email: data.email, name: data.full_name };
}

/**
 * The acting team member, resolved by initAuth(). Writes attribute to this
 * profile; in user mode it also matches the session's auth.uid().
 */
export async function getActor(): Promise<Actor> {
  if (!actorCache) {
    throw new Error("Actor used before initAuth() — this is a bug.");
  }
  return actorCache;
}

export type ProjectRef = { id: string; name: string; status: string };

/**
 * Resolve a project by (partial, case-insensitive) name. Errors list the
 * candidates so the model can retry with something unambiguous.
 */
export async function resolveProject(name: string): Promise<ProjectRef> {
  const { data, error } = await supabase()
    .from("projects")
    .select("id, name, status");
  if (error) throw new Error(`Couldn't load projects: ${error.message}`);
  const projects = (data ?? []) as ProjectRef[];
  if (projects.length === 0) {
    throw new Error(
      "No projects exist yet. Create one first with brain_create_project.",
    );
  }

  const needle = name.trim().toLowerCase();
  const exact = projects.filter((p) => p.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const partial = projects.filter((p) => p.name.toLowerCase().includes(needle));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new Error(
      `"${name}" matches multiple projects: ${partial.map((p) => p.name).join(", ")}. ` +
        "Use a more specific name.",
    );
  }
  throw new Error(
    `No project matches "${name}". Existing projects: ${projects
      .map((p) => p.name)
      .join(", ")}.`,
  );
}
