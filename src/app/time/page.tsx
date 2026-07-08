import { redirect } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { TimerCard } from "@/components/time/timer-card";
import { ManualEntryDialog } from "@/components/time/manual-entry-dialog";
import { DailyHoursChart } from "@/components/time/daily-hours-chart";
import { TimePeopleFilter } from "@/components/time/time-people-filter";
import {
  SessionTable,
  type SessionActivityItem,
  type SessionEntry,
} from "@/components/time/session-table";
import { createClient } from "@/lib/supabase/server";
import {
  daysAgoISO,
  entryDurationMs,
  formatDateTime,
  formatDuration,
} from "@/lib/format";

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string }>;
}) {
  const { who } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekAgo = daysAgoISO(7);
  const twoWeeksAgo = daysAgoISO(14);

  let entriesQuery = supabase
    .from("time_entries")
    .select("*")
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(50);
  if (who) entriesQuery = entriesQuery.eq("user_id", who);

  const [projectsRes, entriesRes, metricsRes, runningRes, profilesRes] =
    await Promise.all([
      supabase.from("projects").select("*").order("name"),
      entriesQuery,
      // Uncapped 14-day window that backs the metrics/charts.
      supabase
        .from("time_entries")
        .select("user_id, project_id, started_at, ended_at")
        .not("ended_at", "is", null)
        .gte("started_at", twoWeeksAgo),
      supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .maybeSingle(),
      supabase.from("profiles").select("*"),
    ]);

  const projects = projectsRes.data ?? [];
  const entries = entriesRes.data ?? [];
  const metrics = metricsRes.data ?? [];
  const running = runningRes.data ?? null;
  const profiles = profilesRes.data ?? [];

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const activeProjects = projects.filter((p) => p.status === "active");

  // Last-7-days summaries, computed from the full 14-day window.
  const recent = metrics.filter((e) => e.started_at >= weekAgo);
  const myMs = recent
    .filter((e) => e.user_id === user.id)
    .reduce((sum, e) => sum + entryDurationMs(e.started_at, e.ended_at), 0);
  const teamMs = recent.reduce(
    (sum, e) => sum + entryDurationMs(e.started_at, e.ended_at),
    0,
  );
  const perProject = new Map<string, number>();
  for (const e of recent) {
    perProject.set(
      e.project_id,
      (perProject.get(e.project_id) ?? 0) +
        entryDurationMs(e.started_at, e.ended_at),
    );
  }
  const topProjects = [...perProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Per-person totals (7 days).
  const perPersonMs = new Map<string, number>();
  for (const e of recent) {
    perPersonMs.set(
      e.user_id,
      (perPersonMs.get(e.user_id) ?? 0) +
        entryDurationMs(e.started_at, e.ended_at),
    );
  }
  const perPerson = [...perPersonMs.entries()].sort((a, b) => b[1] - a[1]);
  const maxPersonMs = Math.max(1, ...perPerson.map(([, ms]) => ms));

  // Daily team totals for the last 14 days (bucketed by local calendar day).
  const now = new Date();
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - i));
    return {
      key: dayKey(d),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      fullLabel: d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      dayLetter: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      isToday: dayKey(d) === dayKey(now),
    };
  });
  const msByDay = new Map(days.map((d) => [d.key, 0]));
  for (const e of metrics) {
    const key = dayKey(new Date(e.started_at));
    if (msByDay.has(key)) {
      msByDay.set(key, msByDay.get(key)! + entryDurationMs(e.started_at, e.ended_at));
    }
  }
  const chartData = days.map((d) => ({
    label: d.label,
    fullLabel: d.fullLabel,
    ms: msByDay.get(d.key)!,
  }));
  // Display-only slice of the same 14-day dataset for the week mini bar
  // chart (spec calls for 7 day columns) — no additional query, no change
  // to what's tracked.
  const weekBars = days.slice(-7).map((d) => ({
    ...d,
    ms: msByDay.get(d.key)!,
  }));
  const weekBarsMax = Math.max(1, ...weekBars.map((d) => d.ms));

  // Session activity: items each person created *during* one of their entries.
  // Fetch once over the window the displayed entries span, then bucket per entry.
  const oldestStart = entries.reduce(
    (min, e) => (e.started_at < min ? e.started_at : min),
    entries[0]?.started_at ?? new Date().toISOString(),
  );
  const [notesRes, activityPromptsRes, knowledgeRes] =
    entries.length > 0
      ? await Promise.all([
          supabase
            .from("notes")
            .select("id, title, author_id, created_at")
            .gte("created_at", oldestStart),
          supabase
            .from("prompts")
            .select("id, title, user_id, created_at")
            .gte("created_at", oldestStart),
          supabase
            .from("knowledge_items")
            .select("id, title, created_by, created_at")
            .gte("created_at", oldestStart),
        ])
      : [null, null, null];

  const within = (created: string, start: string, end: string | null) => {
    const t = new Date(created).getTime();
    return (
      t >= new Date(start).getTime() &&
      (end == null || t <= new Date(end).getTime())
    );
  };

  const sessionEntries: SessionEntry[] = entries.map((entry) => {
    const activity: SessionActivityItem[] = [];
    for (const n of notesRes?.data ?? []) {
      if (n.author_id === entry.user_id && within(n.created_at, entry.started_at, entry.ended_at)) {
        activity.push({ id: n.id, title: n.title, kind: "note", href: `/notes/${n.id}` });
      }
    }
    for (const p of activityPromptsRes?.data ?? []) {
      if (p.user_id === entry.user_id && within(p.created_at, entry.started_at, entry.ended_at)) {
        activity.push({ id: p.id, title: p.title, kind: "prompt", href: "/prompts" });
      }
    }
    for (const k of knowledgeRes?.data ?? []) {
      if (k.created_by === entry.user_id && within(k.created_at, entry.started_at, entry.ended_at)) {
        activity.push({ id: k.id, title: k.title, kind: "knowledge", href: "/brain" });
      }
    }
    const profile = profileById.get(entry.user_id);
    return {
      id: entry.id,
      projectName: projectById.get(entry.project_id)?.name ?? "—",
      whoName: profile?.full_name ?? profile?.email ?? "—",
      when: formatDateTime(entry.started_at),
      durationLabel: formatDuration(entryDurationMs(entry.started_at, entry.ended_at)),
      notes: entry.notes,
      source: entry.source,
      activity,
    };
  });

  const peopleOptions = profiles.map((p) => ({
    id: p.id,
    label: p.full_name ?? p.email,
  }));

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-[34px] py-[30px]">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Time
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
            Team logged {formatDuration(teamMs)} this week · you{" "}
            {formatDuration(myMs)}.
          </p>
        </div>
        <ManualEntryDialog
          projects={activeProjects}
          trigger={
            <Button
              variant="outline"
              className="rounded-full border-[#e2ddd6] bg-white px-4 text-[var(--v2-ink-1)] hover:bg-[#f6f4f1]"
            >
              <Plus className="size-4" />
              Log time
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TimerCard
          projects={activeProjects}
          runningEntry={
            running
              ? {
                  ...running,
                  projectName:
                    projectById.get(running.project_id)?.name ?? "a project",
                }
              : null
          }
        />

        <div
          className="rounded-[13px] bg-white"
          style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
        >
          <p className="font-mono-label">Last 7 days</p>
          <div className="mt-2 text-3xl font-semibold text-[var(--v2-ink-1)] tabular-nums">
            {formatDuration(myMs)}
          </div>
          <p className="mt-1 text-[13px] text-[var(--v2-ink-2)]">
            you · {formatDuration(teamMs)} as a team
          </p>
        </div>

        <div
          className="rounded-[13px] bg-white"
          style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
        >
          <p className="font-mono-label">Top projects (7d)</p>
          <div className="mt-3 flex flex-col gap-2">
            {topProjects.length === 0 && (
              <p className="text-[13px] text-[var(--v2-ink-3)]">
                No time logged yet this week.
              </p>
            )}
            {topProjects.map(([projectId, ms]) => (
              <div key={projectId} className="flex items-center justify-between text-[13px]">
                <span className="truncate text-[var(--v2-ink-1)]">
                  {projectById.get(projectId)?.name ?? "Unknown"}
                </span>
                <span className="font-mono text-[12px] text-[var(--v2-ink-2)] tabular-nums">
                  {formatDuration(ms)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div
          className="rounded-[13px] bg-white lg:col-span-2"
          style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
        >
          <p className="font-mono-label">This week</p>
          <p className="mt-1 mb-4 text-[13px] text-[var(--v2-ink-2)]">
            Whole team, daily totals · completed sessions
          </p>
          {teamMs === 0 && weekBars.every((d) => d.ms === 0) ? (
            <p className="text-[13px] text-[var(--v2-ink-3)]">
              No time logged this week yet.
            </p>
          ) : (
            <div className="flex items-end gap-2" style={{ height: 88 }}>
              {weekBars.map((d) => {
                const barHeight = Math.max(
                  2,
                  Math.round((d.ms / weekBarsMax) * 66),
                );
                return (
                  <div
                    key={d.key}
                    className="flex flex-1 flex-col items-center gap-1.5"
                    title={`${d.fullLabel}: ${formatDuration(d.ms)}`}
                  >
                    <span className="font-mono text-[9px] text-[var(--v2-ink-3)] tabular-nums">
                      {d.ms > 0 ? formatDuration(d.ms) : ""}
                    </span>
                    <div
                      className="flex w-full flex-1 items-end"
                      style={{ height: 66 }}
                    >
                      <div
                        className="w-full rounded-t-[3px]"
                        style={{
                          height: barHeight,
                          backgroundColor: d.isToday ? "#1c1c1f" : "#e7e5e0",
                        }}
                      />
                    </div>
                    <span
                      className="font-mono text-[9.5px] tabular-nums"
                      style={{
                        color: d.isToday
                          ? "var(--v2-ink-1)"
                          : "var(--v2-ink-3)",
                      }}
                    >
                      {d.dayLetter}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="rounded-[13px] bg-white"
          style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
        >
          <p className="font-mono-label">By person (7d)</p>
          <div className="mt-3 flex flex-col gap-3">
            {perPerson.length === 0 && (
              <p className="text-[13px] text-[var(--v2-ink-3)]">
                No time logged yet this week.
              </p>
            )}
            {perPerson.map(([userId, ms]) => {
              const profile = profileById.get(userId);
              return (
                <div key={userId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="truncate text-[var(--v2-ink-1)]">
                      {profile?.full_name ?? profile?.email ?? "Unknown"}
                    </span>
                    <span className="font-mono text-[12px] text-[var(--v2-ink-2)] tabular-nums">
                      {formatDuration(ms)}
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "#f4f2ef" }}
                  >
                    <div
                      className="h-full rounded-full bg-[#1c1c1f]"
                      style={{ width: `${(ms / maxPersonMs) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Kept for reference in the "Daily hours" 14-day view — same data,
          longer window; visually secondary to the week bar chart above. */}
      <details className="mt-4">
        <summary className="font-mono-label cursor-pointer select-none">
          Daily hours · last 14 days
        </summary>
        <div
          className="mt-2 rounded-[13px] bg-white"
          style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
        >
          {teamMs === 0 && chartData.every((d) => d.ms === 0) ? (
            <p className="text-[13px] text-[var(--v2-ink-3)]">
              No time logged in the last two weeks yet.
            </p>
          ) : (
            <DailyHoursChart data={chartData} />
          )}
        </div>
      </details>

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[18px] text-[var(--v2-ink-1)]">
          Recent entries
        </h2>
        <TimePeopleFilter people={peopleOptions} />
      </div>
      {entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nothing logged yet"
          description={
            who
              ? "No entries for this person yet."
              : "Start the timer or log time manually to see entries here."
          }
        />
      ) : (
        <div
          className="overflow-x-auto rounded-[13px] bg-white"
          style={{ border: "1px solid #ededeb" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: "#f4f2ef" }}>
                <TableHead className="font-mono-label h-9">Project</TableHead>
                <TableHead className="font-mono-label h-9">Who</TableHead>
                <TableHead className="font-mono-label h-9">When</TableHead>
                <TableHead className="font-mono-label h-9 text-right">
                  Duration
                </TableHead>
                <TableHead className="font-mono-label h-9">Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <SessionTable entries={sessionEntries} />
          </Table>
        </div>
      )}
    </main>
  );
}
