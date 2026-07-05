import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppHeader } from "@/components/app-header";
import { TimerCard } from "@/components/time/timer-card";
import { ManualEntryDialog } from "@/components/time/manual-entry-dialog";
import { DeleteEntryButton } from "@/components/time/delete-entry-button";
import { DailyHoursChart } from "@/components/time/daily-hours-chart";
import { createClient } from "@/lib/supabase/server";
import {
  daysAgoISO,
  entryDurationMs,
  formatDateTime,
  formatDuration,
} from "@/lib/format";

export default async function TimePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekAgo = daysAgoISO(7);
  const twoWeeksAgo = daysAgoISO(14);

  const [projectsRes, entriesRes, metricsRes, runningRes, profilesRes] =
    await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase
        .from("time_entries")
        .select("*")
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(50),
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

        <h2 className="mt-8 mb-3 text-lg font-semibold">Recent entries</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet. Start the timer or log time manually.
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
              <TableBody>
                {entries.map((entry) => {
                  const profile = profileById.get(entry.user_id);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {projectById.get(entry.project_id)?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {profile?.full_name ?? profile?.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(entry.started_at)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDuration(
                          entryDurationMs(entry.started_at, entry.ended_at),
                        )}
                      </TableCell>
                      <TableCell className="max-w-56">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-muted-foreground">
                            {entry.notes ?? ""}
                          </span>
                          {entry.source === "manual" && (
                            <Badge variant="outline">manual</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-10">
                        <DeleteEntryButton entryId={entry.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  );
}
