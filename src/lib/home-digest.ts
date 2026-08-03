/**
 * Pure helpers for the Home digest (V2 Task 7).
 *
 * All day bucketing uses LOCAL dates — never toISOString() for day math.
 */

import { entryDurationMs } from "@/lib/format";

/** "Good morning" | "Good afternoon" | "Good evening" from a local hour. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Mono date stamp, e.g. "MON · JUL 6" (local). */
export function monoDate(now: Date): string {
  const weekday = now
    .toLocaleDateString(undefined, { weekday: "short" })
    .toUpperCase();
  const month = now
    .toLocaleDateString(undefined, { month: "short" })
    .toUpperCase();
  return `${weekday} · ${month} ${now.getDate()}`;
}

/** Compact relative time: "just now", "14m ago", "3h ago", "2d ago". */
export function relativeTime(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Identity colors cycled per person (dot ring + actor name). */
export const ACTOR_COLORS = ["#4a5b8a", "#3f7a56", "#8a6a2a", "#5b3fd6"];

type ProfileLite = { id: string; full_name: string | null; email: string };

/** Stable identity color per person — sorted by id so colors never shift. */
export function buildActorColorMap(profiles: ProfileLite[]): Map<string, string> {
  return new Map(
    [...profiles]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p, i) => [p.id, ACTOR_COLORS[i % ACTOR_COLORS.length]]),
  );
}

/** First name (or email localpart) for feed display. */
export function shortNameOf(p: ProfileLite | undefined): string {
  const full = p?.full_name ?? p?.email ?? "Someone";
  return full.split(/[\s@]+/)[0];
}

export type FeedItem = {
  /** Stable key for React lists. */
  key: string;
  /** Profile id of who did it — drives the "Mine" filter + identity color. */
  actorId: string;
  /** Display name of who did it. */
  actor: string;
  /** Past-tense verb, e.g. "updated". */
  verb: string;
  /** What was acted on, e.g. a note title. */
  object: string;
  /** Where it lives, e.g. "notes" or a project name. */
  context: string;
  /** Link target for the object. */
  href: string;
  /** Kind drives the feed dot color. */
  kind:
    | "note"
    | "prompt"
    | "time"
    | "idea"
    | "task"
    | "project"
    | "knowledge"
    | "agent"
    | "academy";
  /** ISO timestamp used for sorting + relative label. */
  at: string;
};

/** Latest-first union of activity, capped at `limit`. */
export function assembleFeed(items: FeedItem[], limit: number): FeedItem[] {
  return [...items]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/** How many feed items happened in the last 24h (the "since you left" count). */
export function countSince(items: FeedItem[], now: Date): number {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  return items.filter((i) => new Date(i.at).getTime() >= cutoff).length;
}

export type DayBucket = {
  key: string;
  /** Narrow weekday letter, e.g. "M". */
  letter: string;
  isToday: boolean;
  start: Date;
  end: Date;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** The last 7 local calendar days ending today, ascending. */
export function buildDayBuckets(now: Date): DayBucket[] {
  return Array.from({ length: 7 }, (_, i) => {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (6 - i),
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 1,
    );
    return {
      key: dayKey(start),
      letter: start.toLocaleDateString(undefined, { weekday: "narrow" }),
      isToday: dayKey(start) === dayKey(now),
      start,
      end,
    };
  });
}

type EntryLike = { started_at: string; ended_at: string | null };

/** Total ms per local day; entries land on the day their LOCAL start falls. */
export function bucketMsByDay(
  entries: EntryLike[],
  buckets: DayBucket[],
): number[] {
  const totals = buckets.map(() => 0);
  for (const e of entries) {
    const started = new Date(e.started_at);
    for (let i = 0; i < buckets.length; i++) {
      if (started >= buckets[i].start && started < buckets[i].end) {
        totals[i] += entryDurationMs(e.started_at, e.ended_at);
        break;
      }
    }
  }
  return totals;
}
