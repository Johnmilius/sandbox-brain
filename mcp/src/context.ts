/**
 * Shared context: environment, Supabase client, actor identity, and
 * common resolvers used by every tool.
 *
 * Env vars (from the MCP client config, with ../.env.local as fallback):
 *   SUPABASE_URL                (falls back to NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY   secret; local machines only, never committed
 *   BRAIN_ACTOR_EMAIL           whose actions these are (per-machine identity)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));

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
export const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
export const ACTOR_EMAIL = env("BRAIN_ACTOR_EMAIL")?.toLowerCase();

export function assertConfigured(): string | null {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!ACTOR_EMAIL) missing.push("BRAIN_ACTOR_EMAIL");
  if (missing.length === 0) return null;
  return (
    `Missing configuration: ${missing.join(", ")}. ` +
    "Set them in the MCP client config env, or in the repo's .env.local. " +
    "The service role key is under Supabase -> Settings -> API."
  );
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type Actor = { id: string; email: string; name: string | null };

let actorCache: Actor | null = null;

/**
 * Resolve the acting team member from BRAIN_ACTOR_EMAIL. The service role
 * key bypasses RLS, so every write must set user/author columns explicitly
 * to this profile for correct attribution.
 */
export async function getActor(): Promise<Actor> {
  if (actorCache) return actorCache;
  const { data, error } = await supabase()
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
