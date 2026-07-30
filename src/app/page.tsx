import Link from "next/link";
import { redirect } from "next/navigation";
import { Rss } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getAuthedUser } from "@/lib/supabase/auth";
import { formatDuration, entryDurationMs } from "@/lib/format";
import { FlowingFeed, type FlowFeedItem } from "@/components/home/flowing-feed";
import { eventToFeedItem, eventedObjectKeys } from "@/lib/event-feed";
import {
  ACTOR_COLORS,
  assembleFeed,
  bucketMsByDay,
  buildActorColorMap,
  buildDayBuckets,
  countSince,
  greetingFor,
  monoDate,
  relativeTime,
  shortNameOf,
  type FeedItem,
} from "@/lib/home-digest";

const FEED_LIMIT = 8;

export default async function HomePage() {
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect("/login");

  const now = new Date();
  const dayBuckets = buildDayBuckets(now);
  const weekCutoff = dayBuckets[0].start.toISOString();

  const [
    profilesRes,
    projectsRes,
    eventsRes,
    notesRes,
    promptsRes,
    ideasRes,
    recentEntriesRes,
    weekEntriesRes,
    tasksRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("projects").select("id, name, status"),
    // The canonical feed source (migration 0009). Errors (table missing
    // pre-0009) degrade to the legacy per-table union below.
    supabase
      .from("events")
      .select(
        "id, actor_id, verb, object_type, object_id, object_label, target_type, target_id, target_label, occurred_at",
      )
      .order("occurred_at", { ascending: false })
      .limit(40),
    supabase
      .from("notes")
      .select("id, title, author_id, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(FEED_LIMIT),
    supabase
      .from("prompts")
      .select("id, title, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(FEED_LIMIT),
    supabase
      .from("ideas")
      .select("id, title, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(FEED_LIMIT),
    supabase
      .from("time_entries")
      .select("id, user_id, project_id, started_at, ended_at")
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(FEED_LIMIT),
    supabase
      .from("time_entries")
      .select("project_id, started_at, ended_at")
      .not("ended_at", "is", null)
      .gte("started_at", weekCutoff),
    // Task-completion % per project (design intent for the rail bars).
    // Errors (table missing pre-0007) degrade to the time-share fallback.
    supabase.from("tasks").select("project_id, status"),
  ]);

  const profiles = profilesRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  // Stable identity color per person.
  const actorColorById = buildActorColorMap(profiles);
  const actorName = (id: string) => shortNameOf(profileById.get(id));

  const profile = profileById.get(user.id);
  const firstName = (
    profile?.full_name ??
    (user.user_metadata.full_name as string | undefined) ??
    user.email ??
    "there"
  ).split(/[\s@]+/)[0];

  // The events timeline is the canonical feed; the legacy union covers
  // pre-0009 databases and rows written before events existed.
  const eventRows = eventsRes.error ? [] : eventsRes.data ?? [];
  const eventItems: FeedItem[] = eventRows.map((e) => eventToFeedItem(e, actorName));

  // Objects the timeline already accounts for, so the legacy union below can
  // skip them instead of double-reporting the same action.
  const eventedObjects = eventedObjectKeys(eventRows);

  // Union of recent activity → one feed. Rows the timeline already covers are
  // filtered out; what's left is history from before events existed (or a
  // client that writes without emitting).
  const legacyCandidates: FeedItem[] = [
    ...(notesRes.data ?? [])
      .filter((n) => !eventedObjects.has(`note:${n.id}`))
      .map((n) => ({
        key: `note:${n.id}:${n.updated_at}`,
        actorId: n.author_id,
        actor: actorName(n.author_id),
        verb: n.created_at === n.updated_at ? "wrote" : "updated",
        object: n.title,
        context: "notes",
        href: `/notes/${n.id}`,
        kind: "note" as const,
        at: n.updated_at,
      })),
    ...(promptsRes.data ?? [])
      .filter((p) => !eventedObjects.has(`prompt:${p.id}`))
      .map((p) => ({
        key: `prompt:${p.id}`,
        actorId: p.user_id,
        actor: actorName(p.user_id),
        verb: "saved",
        object: p.title,
        context: "prompt library",
        href: "/prompts",
        kind: "prompt" as const,
        at: p.created_at,
      })),
    ...(ideasRes.data ?? [])
      .filter((i) => !eventedObjects.has(`idea:${i.id}`))
      .map((i) => ({
        key: `idea:${i.id}`,
        actorId: i.created_by,
        actor: actorName(i.created_by),
        verb: "captured",
        object: i.title,
        context: "ideas",
        href: `/ideas/${i.id}`,
        kind: "idea" as const,
        at: i.created_at,
      })),
    ...(recentEntriesRes.data ?? [])
      .filter((e) => !eventedObjects.has(`time_entry:${e.id}`))
      .map((e) => ({
        key: `time:${e.id}`,
        actorId: e.user_id,
        actor: actorName(e.user_id),
        verb: "logged",
        object: formatDuration(entryDurationMs(e.started_at, e.ended_at)),
        context: projectById.get(e.project_id)?.name ?? "a project",
        href: "/time",
        kind: "time" as const,
        at: e.started_at,
      })),
  ];

  // Both sources, not one or the other: a single event used to hide the entire
  // pre-events history (and every row written by a client that doesn't emit).
  // assembleFeed sorts the union by time.
  const candidates = [...eventItems, ...legacyCandidates];
  const feed = assembleFeed(candidates, FEED_LIMIT);
  const sinceCount = countSince(candidates, now);

  // Keyset cursor for "Load more" — only when the feed is event-backed and
  // more events exist past what's shown (legacy fallback can't paginate).
  const lastShown = feed[feed.length - 1];
  // Only an event-keyed tail yields a valid keyset cursor; a legacy item at the
  // boundary would hand "Load more" a non-event id.
  const initialCursor =
    eventItems.length > FEED_LIMIT && lastShown?.key.startsWith("event:")
      ? { occurredAt: lastShown.at, id: lastShown.key.slice("event:".length) }
      : null;

  const feedItems: FlowFeedItem[] = feed.map((item) => ({
    ...item,
    actorColor: actorColorById.get(item.actorId) ?? ACTOR_COLORS[0],
    timeLabel: relativeTime(item.at, now),
  }));

  // Right rail: this week's hours per day + per-project stats.
  const weekEntries = weekEntriesRes.data ?? [];
  const dayMs = bucketMsByDay(weekEntries, dayBuckets);
  const weekTotalMs = dayMs.reduce((a, b) => a + b, 0);
  const dayMax = Math.max(1, ...dayMs);
  const weekHours = (weekTotalMs / 3_600_000).toFixed(1);

  const msByProject = new Map<string, number>();
  for (const e of weekEntries) {
    msByProject.set(
      e.project_id,
      (msByProject.get(e.project_id) ?? 0) +
        entryDurationMs(e.started_at, e.ended_at),
    );
  }

  // % complete per project from tasks (design intent); projects without
  // tickets (or pre-0007) fall back to their share of this week's hours.
  const taskTally = new Map<string, { done: number; total: number }>();
  if (!tasksRes.error) {
    for (const t of tasksRes.data ?? []) {
      const tally = taskTally.get(t.project_id) ?? { done: 0, total: 0 };
      tally.total += 1;
      if (t.status === "done") tally.done += 1;
      taskTally.set(t.project_id, tally);
    }
  }

  const activeProjects = projects
    .filter((p) => p.status === "active")
    .map((p) => {
      const tally = taskTally.get(p.id);
      const pct = tally
        ? Math.round((tally.done / tally.total) * 100)
        : weekTotalMs > 0
          ? Math.round(((msByProject.get(p.id) ?? 0) / weekTotalMs) * 100)
          : 0;
      return { id: p.id, name: p.name, pct };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  // Third feed pill: the project with the most hours this week.
  let topProject: string | null = null;
  let topMs = 0;
  for (const [projectId, ms] of msByProject) {
    if (ms > topMs) {
      topMs = ms;
      topProject = projectById.get(projectId)?.name ?? null;
    }
  }

  // "Time logged" footer caption — today vs the busiest day of the week.
  const todayIdx = dayBuckets.findIndex((d) => d.isToday);
  const busiestIdx = dayMs.indexOf(Math.max(...dayMs));
  const shortDay = (i: number) =>
    dayBuckets[i]?.start.toLocaleDateString(undefined, { weekday: "short" }) ??
    "";
  const hoursOf = (i: number) => (dayMs[i] / 3_600_000).toFixed(1);
  const caption =
    todayIdx >= 0 && weekTotalMs > 0
      ? busiestIdx === todayIdx
        ? `${shortDay(todayIdx)} is today — your busiest day at ${hoursOf(todayIdx)}h`
        : `${shortDay(todayIdx)} is today — busiest was ${shortDay(busiestIdx)} at ${hoursOf(busiestIdx)}h`
      : null;

  return (
    <div className="flex min-h-full flex-1">
      <div className="min-w-0 flex-1 px-[34px] py-[30px]">
        <div className="flex items-baseline justify-between gap-4">
          <h1
            className="font-display text-[29px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            {greetingFor(now.getHours())}, {firstName}
          </h1>
          <span className="font-mono shrink-0 text-[11px] text-[var(--v2-ink-3)]">
            {monoDate(now)}
          </span>
        </div>
        <p className="mt-0.5 text-[13.5px] text-[var(--v2-ink-2)]">
          {sinceCount === 0
            ? "All quiet since you left — nothing new in the brain."
            : `${sinceCount} thing${sinceCount === 1 ? "" : "s"} moved through the brain since you left.`}
        </p>

        {feedItems.length === 0 ? (
          <>
            <p className="font-mono-label mt-8 mb-4">Flowing now</p>
            <EmptyState
              icon={Rss}
              title="Nothing flowing yet"
              description="Notes, prompts, ideas, and logged time will show up here as the team works."
            />
          </>
        ) : (
          <FlowingFeed
            items={feedItems}
            currentUserId={user.id}
            topProject={topProject}
            initialCursor={initialCursor}
          />
        )}
      </div>

      <aside
        className="w-[262px] shrink-0 border-l"
        style={{
          backgroundColor: "var(--v2-rail-bg)",
          borderColor: "#f0eeeb",
          padding: "30px 22px",
        }}
      >
        <p className="font-mono-label mb-3.5">Active projects</p>
        <div className="mb-7 flex flex-col gap-[15px]">
          {activeProjects.length === 0 && (
            <p className="text-[12px] text-[var(--v2-ink-4)]">
              No active projects yet.
            </p>
          )}
          {activeProjects.map((p) => (
            <Link key={p.id} href={`/tasks?project=${p.id}`} className="block">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-[var(--v2-ink-1)]">
                  {p.name}
                </span>
                <span className="font-mono shrink-0 text-[11px] text-[var(--v2-ink-3)] tabular-nums">
                  {p.pct}%
                </span>
              </div>
              <div
                className="mt-1.5 h-[5px] w-full overflow-hidden rounded-[3px]"
                style={{ backgroundColor: "#efece7" }}
              >
                <div
                  className="h-full rounded-[3px] bg-[#1c1c1f]"
                  style={{ width: `${p.pct}%` }}
                />
              </div>
            </Link>
          ))}
        </div>

        <div className="flex items-baseline justify-between">
          <p className="font-mono-label">Time logged</p>
          <span className="font-mono text-[10px] text-[var(--v2-ink-2)]">
            {weekHours}h total
          </span>
        </div>
        <p className="mt-0.5 mb-3.5 text-[11px] text-[var(--v2-ink-3)]">
          Hours the team tracked each day this week.
        </p>
        {weekTotalMs === 0 ? (
          <p className="text-[12px] text-[var(--v2-ink-4)]">
            No time logged yet this week.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-[5px]" style={{ height: 66 }}>
              {dayBuckets.map((day, i) => {
                const ms = dayMs[i];
                const barHeight = Math.max(2, Math.round((ms / dayMax) * 48));
                return (
                  <div
                    key={day.key}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                    title={formatDuration(ms)}
                  >
                    <span
                      className="font-mono text-[9px] tabular-nums"
                      style={{
                        color: day.isToday
                          ? "var(--v2-ink-1)"
                          : "var(--v2-ink-3)",
                        fontWeight: day.isToday ? 600 : 400,
                      }}
                    >
                      {ms > 0 ? (ms / 3_600_000).toFixed(1) : ""}
                    </span>
                    <div
                      className="w-full rounded-[3px]"
                      style={{
                        height: barHeight,
                        backgroundColor: day.isToday ? "#1c1c1f" : "#e7e5e0",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="font-mono mt-1.5 flex gap-[5px]">
              {dayBuckets.map((day) => (
                <span
                  key={day.key}
                  className="flex-1 text-center text-[9.5px]"
                  style={{
                    color: day.isToday ? "var(--v2-ink-1)" : "var(--v2-ink-3)",
                    fontWeight: day.isToday ? 600 : 400,
                  }}
                >
                  {day.letter}
                </span>
              ))}
            </div>
            {caption && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--v2-ink-2)]">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: "#1c1c1f" }}
                />
                {caption}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
