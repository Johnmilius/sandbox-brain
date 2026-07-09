import Link from "next/link";
import { redirect } from "next/navigation";
import { Rss } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, entryDurationMs } from "@/lib/format";
import {
  assembleFeed,
  bucketMsByDay,
  buildDayBuckets,
  countSince,
  greetingFor,
  monoDate,
  relativeTime,
  type FeedItem,
} from "@/lib/home-digest";

const FEED_LIMIT = 8;

const KIND_DOT: Record<FeedItem["kind"], string> = {
  note: "#4a5b8a",
  prompt: "#8a6a2a",
  time: "#3f7a56",
  idea: "#e0a53f",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const dayBuckets = buildDayBuckets(now);
  const weekCutoff = dayBuckets[0].start.toISOString();

  const [
    profilesRes,
    projectsRes,
    notesRes,
    promptsRes,
    ideasRes,
    recentEntriesRes,
    weekEntriesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("projects").select("id, name, status"),
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
  ]);

  const profiles = profilesRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const actorName = (id: string) => {
    const p = profileById.get(id);
    const full = p?.full_name ?? p?.email ?? "Someone";
    return full.split(/[\s@]+/)[0];
  };

  const profile = profileById.get(user.id);
  const firstName = (
    profile?.full_name ??
    (user.user_metadata.full_name as string | undefined) ??
    user.email ??
    "there"
  ).split(/[\s@]+/)[0];

  // Union of recent activity → one feed.
  const candidates: FeedItem[] = [
    ...(notesRes.data ?? []).map((n) => ({
      key: `note:${n.id}:${n.updated_at}`,
      actor: actorName(n.author_id),
      verb: n.created_at === n.updated_at ? "wrote" : "updated",
      object: n.title,
      context: "notes",
      href: `/notes/${n.id}`,
      kind: "note" as const,
      at: n.updated_at,
    })),
    ...(promptsRes.data ?? []).map((p) => ({
      key: `prompt:${p.id}`,
      actor: actorName(p.user_id),
      verb: "saved",
      object: p.title,
      context: "prompt library",
      href: "/prompts",
      kind: "prompt" as const,
      at: p.created_at,
    })),
    ...(ideasRes.data ?? []).map((i) => ({
      key: `idea:${i.id}`,
      actor: actorName(i.created_by),
      verb: "captured",
      object: i.title,
      context: "ideas",
      href: `/ideas/${i.id}`,
      kind: "idea" as const,
      at: i.created_at,
    })),
    ...(recentEntriesRes.data ?? []).map((e) => ({
      key: `time:${e.id}`,
      actor: actorName(e.user_id),
      verb: "logged",
      object: formatDuration(entryDurationMs(e.started_at, e.ended_at)),
      context: projectById.get(e.project_id)?.name ?? "a project",
      href: "/time",
      kind: "time" as const,
      at: e.started_at,
    })),
  ];

  const feed = assembleFeed(candidates, FEED_LIMIT);
  const sinceCount = countSince(candidates, now);

  // Right rail: this week's hours + per-project share.
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
  const activeProjects = projects
    .filter((p) => p.status === "active")
    .map((p) => ({
      id: p.id,
      name: p.name,
      pct:
        weekTotalMs > 0
          ? Math.round(((msByProject.get(p.id) ?? 0) / weekTotalMs) * 100)
          : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

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
          <span className="font-mono shrink-0 text-[10px] tracking-[0.1em] text-[var(--v2-ink-3)]">
            {monoDate(now)}
          </span>
        </div>
        <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
          {sinceCount === 0
            ? "All quiet since you left — nothing new in the brain."
            : `${sinceCount} thing${sinceCount === 1 ? "" : "s"} moved through the brain since you left.`}
        </p>

        <p className="font-mono-label mt-8 mb-4">Flowing now</p>

        {feed.length === 0 ? (
          <EmptyState
            icon={Rss}
            title="Nothing flowing yet"
            description="Notes, prompts, ideas, and logged time will show up here as the team works."
          />
        ) : (
          <div
            className="relative flex flex-col gap-4 pl-5"
            style={{ borderLeft: "1px dashed #d6d3cd", marginLeft: 4 }}
          >
            {feed.map((item) => (
              <div key={item.key} className="relative">
                <span
                  className="absolute top-[5px] -left-[25px] size-2 rounded-full border-2 border-white"
                  style={{ backgroundColor: KIND_DOT[item.kind] }}
                />
                <p className="text-[13.5px] leading-snug text-[var(--v2-ink-1)]">
                  <span className="font-semibold">{item.actor}</span>{" "}
                  {item.verb}{" "}
                  <Link
                    href={item.href}
                    className="font-medium hover:underline"
                    style={{ color: "var(--v2-accent-purple)" }}
                  >
                    {item.object}
                  </Link>{" "}
                  <span className="text-[var(--v2-ink-3)]">→ {item.context}</span>
                </p>
                <p className="font-mono mt-0.5 text-[10px] text-[var(--v2-ink-3)]">
                  {relativeTime(item.at, now)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside
        className="w-[262px] shrink-0 border-l"
        style={{
          backgroundColor: "var(--v2-rail-bg)",
          borderColor: "#ededeb",
          padding: "26px 22px",
        }}
      >
        <p className="font-mono-label">Active projects</p>
        <div className="mt-3 flex flex-col gap-3.5">
          {activeProjects.length === 0 && (
            <p className="text-[12px] text-[var(--v2-ink-4)]">
              No active projects yet.
            </p>
          )}
          {activeProjects.map((p) => (
            <Link key={p.id} href="/projects" className="block">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12.5px] font-medium text-[var(--v2-ink-1)]">
                  {p.name}
                </span>
                <span className="font-mono shrink-0 text-[10px] text-[var(--v2-ink-3)] tabular-nums">
                  {p.pct}%
                </span>
              </div>
              <div
                className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "#efece7" }}
              >
                <div
                  className="h-full rounded-full bg-[#1c1c1f]"
                  style={{ width: `${p.pct}%` }}
                />
              </div>
            </Link>
          ))}
        </div>

        <p className="font-mono-label mt-8">This week · {weekHours}h</p>
        <p className="mt-1 text-[11px] text-[var(--v2-ink-3)]">
          Whole team, completed sessions.
        </p>
        {weekTotalMs === 0 ? (
          <p className="mt-3 text-[12px] text-[var(--v2-ink-4)]">
            No time logged yet this week.
          </p>
        ) : (
          <div className="mt-3 flex items-end gap-1.5" style={{ height: 84 }}>
            {dayBuckets.map((day, i) => {
              const ms = dayMs[i];
              const barHeight = Math.max(2, Math.round((ms / dayMax) * 58));
              return (
                <div
                  key={day.key}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${formatDuration(ms)}`}
                >
                  <span className="font-mono text-[9px] text-[var(--v2-ink-3)] tabular-nums">
                    {ms > 0 ? (ms / 3_600_000).toFixed(1) : ""}
                  </span>
                  <div className="flex w-full flex-1 items-end" style={{ height: 58 }}>
                    <div
                      className="w-full rounded-t-[3px]"
                      style={{
                        height: barHeight,
                        backgroundColor: day.isToday ? "#1c1c1f" : "#e7e5e0",
                      }}
                    />
                  </div>
                  <span
                    className="font-mono text-[9.5px]"
                    style={{
                      color: day.isToday
                        ? "var(--v2-ink-1)"
                        : "var(--v2-ink-3)",
                    }}
                  >
                    {day.letter}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
