import { createClient } from "@/lib/supabase/server";
import { daysAgoISO, entryDurationMs } from "@/lib/format";
import { Sidebar, type NavBadges } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import type { TimeEntry } from "@/lib/database.types";

function initialsFor(name: string, email: string): string {
  const source = name || email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // AppShell is only rendered once layout.tsx has confirmed a session
  // exists, but guard defensively in case that check ever drifts.
  if (!user) {
    return <>{children}</>;
  }

  const weekAgo = daysAgoISO(7);

  const [
    profilesRes,
    projectsActiveRes,
    ideasRes,
    runningRes,
    weekEntriesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("ideas").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase
      .from("time_entries")
      .select("*, projects(name)")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .from("time_entries")
      .select("started_at, ended_at")
      .gte("started_at", weekAgo),
  ]);

  const profiles = profilesRes.data ?? [];
  const profile = profiles.find((p) => p.id === user.id);

  const name =
    profile?.full_name ??
    (user.user_metadata.full_name as string | undefined) ??
    (user.user_metadata.name as string | undefined) ??
    user.email ??
    "Team member";
  const initials = initialsFor(name, user.email ?? "");

  // Tasks table doesn't exist yet (lands in a later task) — degrade to no badge.
  let tasksBadge = "";
  try {
    const { count } = await supabase
      .from("tasks" as never)
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id)
      .neq("status", "done");
    tasksBadge = count ? String(count) : "";
  } catch {
    tasksBadge = "";
  }

  const projectsCount = projectsActiveRes.count ?? 0;
  const ideasCount = ideasRes.count ?? 0;

  const weekMs = (weekEntriesRes.data ?? []).reduce(
    (sum, e) => sum + entryDurationMs(e.started_at, e.ended_at),
    0,
  );
  const weekHours = (weekMs / 3_600_000).toFixed(1);

  const badges: NavBadges = {
    projects: projectsCount ? String(projectsCount) : "",
    ideas: ideasCount ? String(ideasCount) : "",
    tasks: tasksBadge,
    time: `${weekHours}h`,
  };

  type RunningRow = TimeEntry & { projects: { name: string } | null };
  const runningRow = runningRes.data as RunningRow | null;
  const runningEntry = runningRow
    ? { ...runningRow, projectName: runningRow.projects?.name ?? "Untitled project" }
    : null;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        badges={badges}
        name={name}
        initials={initials}
        runningEntry={runningEntry}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar currentUser={{ id: user.id, name, initials }} />
        <main className="flex flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
