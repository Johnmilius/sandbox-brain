import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)) });

function required(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key];
    if (value && value.length > 0) return value;
  }
  throw new Error(
    `Missing env var ${name}. Fill it in the repo root .env.local (see .env.example).`,
  );
}

export const env = {
  get SUPABASE_URL() {
    return required("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
};
