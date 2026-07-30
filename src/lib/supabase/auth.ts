import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-request memoized auth check.
 *
 * `middleware.ts` already refreshes the session cookie and gates every
 * non-public route, but the root layout, AppShell, and each page still need
 * the user object itself. Left un-memoized, every one of those is a separate
 * round trip to Supabase auth within a single render pass; React's `cache()`
 * collapses them into one.
 *
 * The client is returned alongside the user so callers can run their own
 * queries on the same instance instead of constructing a second one.
 *
 * Server Actions and Route Handlers each run in their own request, so
 * `cache()` gives them nothing — they keep calling `createClient()` directly.
 */
export const getAuthedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
});
