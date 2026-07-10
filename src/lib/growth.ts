/**
 * Pure helpers for the Growth page (V2 Task 7b).
 *
 * All day/week math uses LOCAL dates — never toISOString() — so a session
 * logged at 11pm Sunday stays in the local week it belongs to.
 */

import { entryDurationMs } from "@/lib/format";
import type { IdeaStatus, ProjectStatus } from "@/lib/database.types";

/** Local midnight on the Monday of the week containing `d`. */
export function weekStartLocal(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday … 6 = Saturday
  const sinceMonday = (day + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
}

/** Local midnight on the first of the month containing `d`. */
export function monthStartLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export type WeekBucket = {
  /** Inclusive local start (Monday 00:00). */
  start: Date;
  /** Exclusive local end (next Monday 00:00). */
  end: Date;
  /** Mono label for the axis, e.g. "JUN 22". */
  label: string;
};

/** The last `count` local weeks ending with the week containing `now`, ascending. */
export function buildWeekBuckets(count: number, now: Date): WeekBucket[] {
  const thisWeek = weekStartLocal(now);
  const buckets: WeekBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(
      thisWeek.getFullYear(),
      thisWeek.getMonth(),
      thisWeek.getDate() - i * 7,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 7,
    );
    buckets.push({
      start,
      end,
      label: start
        .toLocaleDateString(undefined, { month: "short", day: "numeric" })
        .toUpperCase(),
    });
  }
  return buckets;
}

type EntryLike = { started_at: string; ended_at: string | null };

/** Total ms per bucket; entries land in the bucket their LOCAL start falls in. */
export function bucketMsByWeek(
  entries: EntryLike[],
  buckets: WeekBucket[],
): number[] {
  const totals = buckets.map(() => 0);
  for (const e of entries) {
    const started = new Date(e.started_at); // local interpretation
    for (let i = 0; i < buckets.length; i++) {
      if (started >= buckets[i].start && started < buckets[i].end) {
        totals[i] += entryDurationMs(e.started_at, e.ended_at);
        break;
      }
    }
  }
  return totals;
}

export type FunnelCounts = {
  captured: number;
  validating: number;
  building: number;
  shipped: number;
  /** False when the tasks table isn't available (pre-0007) — counts degrade. */
  includesTasks: boolean;
};

type IdeaLike = { status: IdeaStatus };
type ProjectLike = { status: ProjectStatus };
type TaskLike = { status: string; updated_at: string };

/**
 * Pipeline counts per PLAN Adjudication 1:
 * Captured = all ideas · Validating = ideas in validating ·
 * Building = active projects + inprogress tasks ·
 * Shipped = completed projects + tasks done this month.
 * `tasks` is null when the table doesn't exist yet — counts degrade to
 * ideas + projects only.
 */
export function computeFunnel(
  ideas: IdeaLike[],
  projects: ProjectLike[],
  tasks: TaskLike[] | null,
  now: Date,
): FunnelCounts {
  const monthStart = monthStartLocal(now);
  const inprogressTasks =
    tasks?.filter((t) => t.status === "inprogress").length ?? 0;
  const doneTasksThisMonth =
    tasks?.filter(
      (t) => t.status === "done" && new Date(t.updated_at) >= monthStart,
    ).length ?? 0;

  return {
    captured: ideas.length,
    validating: ideas.filter((i) => i.status === "validating").length,
    building:
      projects.filter((p) => p.status === "active").length + inprogressTasks,
    shipped:
      projects.filter((p) => p.status === "completed").length +
      doneTasksThisMonth,
    includesTasks: tasks !== null,
  };
}
