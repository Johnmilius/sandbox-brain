import { supabase } from "./supabase.js";
import {
  buildDashboardSummary,
  WEEK_MS,
  type DashboardData,
  type TimeEntryRow,
} from "./summary.js";

export async function dashboardHandler(): Promise<{
  structuredContent?: DashboardData;
  content: { type: "text"; text: string }[];
  isError: boolean;
}> {
  try {
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
