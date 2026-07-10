import { supabase } from "./supabase.js";
import {
  buildDashboardSummary,
  WEEK_MS,
  type DashboardData,
  type TimeEntryRow,
} from "./summary.js";

const HOUR_MS = 3_600_000;

// Demo mode (BRAIN_DASHBOARD_DEMO=1): realistic synthetic rows fed through the
// SAME buildDashboardSummary pipeline, so the widget renders without Supabase
// credentials while still exercising the real aggregation code path. All
// timestamps are derived from `now` so the data never falls out of the 7-day
// window. Luke ~10.5h, John ~6.8h (≈17.3 team hours), uneven per-project
// splits, plus one running timer for John started ~40 minutes ago.
function demoRows(now: number): TimeEntryRow[] {
  const luke = { email: "lukebmoffat@gmail.com", full_name: "Luke Moffat" };
  const john = { email: "jwmilius@gmail.com", full_name: "John Milius" };
  const entry = (
    profile: { email: string; full_name: string },
    project: string,
    startedHoursAgo: number,
    durationHours: number,
  ): TimeEntryRow => ({
    started_at: new Date(now - startedHoursAgo * HOUR_MS).toISOString(),
    ended_at: new Date(
      now - (startedHoursAgo - durationHours) * HOUR_MS,
    ).toISOString(),
    profiles: profile,
    projects: { name: project },
  });

  return [
    // John's timer is running right now (started ~40 minutes ago).
    {
      started_at: new Date(now - 40 * 60_000).toISOString(),
      ended_at: null,
      profiles: john,
      projects: { name: "Sandbox Brain" },
    },
    entry(luke, "Sandbox Brain", 26, 3),
    entry(john, "First attempt startup", 30, 2.2),
    entry(luke, "Market research", 50, 1.5),
    entry(john, "First attempt startup", 52, 1.3),
    entry(luke, "Sandbox Brain", 75, 2.5),
    entry(john, "Sandbox Brain", 98, 1.8),
    entry(luke, "First attempt startup", 122, 2),
    entry(luke, "Sandbox Brain", 146, 1.5),
    entry(john, "Market research", 150, 1.5),
  ];
}

export async function dashboardHandler(): Promise<{
  structuredContent?: DashboardData;
  content: { type: "text"; text: string }[];
  isError: boolean;
}> {
  try {
    if (process.env.BRAIN_DASHBOARD_DEMO === "1") {
      // Skip Supabase entirely — the lazy client Proxy throws without env
      // vars, so it must never be *called* here (importing it is fine).
      const summary = buildDashboardSummary(demoRows(Date.now()), new Date());
      return {
        structuredContent: summary,
        content: [{ type: "text", text: JSON.stringify(summary) }],
        isError: false,
      };
    }

    const windowStart = new Date(Date.now() - WEEK_MS).toISOString();

    const { data, error } = await supabase
      .from("time_entries")
      .select("started_at, ended_at, profiles(email, full_name), projects(name)")
      .gte("started_at", windowStart)
      .order("started_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Assumes profiles/projects embed as single objects: time_entries has exactly
    // one FK to each (0001_init.sql). A second FK to either would make it an array,
    // needing a `!user_id`/`!project_id` hint above plus a TimeEntryRow update.
    const summary = buildDashboardSummary(
      (data ?? []) as unknown as TimeEntryRow[],
      new Date(),
    );

    return {
      structuredContent: summary,
      content: [{ type: "text", text: JSON.stringify(summary) }],
      isError: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return {
      content: [{ type: "text", text: `Error building dashboard: ${message}` }],
      isError: true,
    };
  }
}
