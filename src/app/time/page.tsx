import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppHeader } from "@/components/app-header";
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

  const name =
    (user.user_metadata.full_name as string | undefined) ??
    (user.user_metadata.name as string | undefined);

  return (
    <>
      <AppHeader
        email={user.email ?? ""}
        name={name}
        avatarUrl={user.user_metadata.avatar_url as string | undefined}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Time</h1>
            <p className="text-sm text-muted-foreground">
              Track work with a live timer, or backfill sessions manually.
            </p>
          </div>
          <ManualEntryDialog
            projects={activeProjects}
            trigger={
              <Button variant="outline">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 7 days</CardTitle>
              <CardDescription>Completed sessions only</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="text-3xl font-semibold">{formatDuration(myMs)}</div>
              <p className="text-sm text-muted-foreground">
                you · {formatDuration(teamMs)} as a team
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top projects (7d)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {topProjects.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No time logged yet this week.
                </p>
              )}
              {topProjects.map(([projectId, ms]) => (
                <div key={projectId} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {projectById.get(projectId)?.name ?? "Unknown"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatDuration(ms)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Daily hours</CardTitle>
              <CardDescription>
                Whole team, last 14 days · completed sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamMs === 0 && chartData.every((d) => d.ms === 0) ? (
                <p className="text-sm text-muted-foreground">
                  No time logged in the last two weeks yet.
                </p>
              ) : (
                <DailyHoursChart data={chartData} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By person (7d)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {perPerson.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No time logged yet this week.
                </p>
              )}
              {perPerson.map(([userId, ms]) => {
                const profile = profileById.get(userId);
                return (
                  <div key={userId} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        {profile?.full_name ?? profile?.email ?? "Unknown"}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatDuration(ms)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${(ms / maxPersonMs) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent entries</h2>
          <TimePeopleFilter people={peopleOptions} />
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {who
              ? "No entries for this person yet."
              : "Nothing logged yet. Start the timer or log time manually."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <SessionTable entries={sessionEntries} />
            </Table>
          </div>
        )}
      </main>
    </>
  );
}
