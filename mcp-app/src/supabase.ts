import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let client: SupabaseClient | null = null;

// Lazy: constructing the client reads env vars, which throw when missing.
// Deferring to first use turns a missing key into a per-request tool error
// instead of a boot-time crash-loop under nodemon.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
