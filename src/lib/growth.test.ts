import { describe, expect, it } from "vitest";
import {
  bucketMsByWeek,
  buildWeekBuckets,
  computeFunnel,
  monthStartLocal,
  weekStartLocal,
} from "@/lib/growth";
import type { IdeaStatus, ProjectStatus } from "@/lib/database.types";

/** Local-time ISO string (no Z) so tests behave the same in any timezone. */
function localISO(
  y: number,
  m: number,
  d: number,
  h = 12,
  min = 0,
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00`;
}

describe("weekStartLocal", () => {
  it("returns the same day for a Monday", () => {
    // 2026-07-06 is a Monday.
    const monday = new Date(2026, 6, 6, 15, 30);
    const start = weekStartLocal(monday);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2026, 6, 6,
    ]);
    expect(start.getHours()).toBe(0);
  });

  it("maps a Sunday back to the previous Monday", () => {
    // 2026-07-12 is a Sunday → week starts 2026-07-06.
    const sunday = new Date(2026, 6, 12, 23, 59);
    const start = weekStartLocal(sunday);
    expect([start.getMonth(), start.getDate()]).toEqual([6, 6]);
  });

  it("crosses a month boundary", () => {
    // 2026-07-01 is a Wednesday → week starts Monday 2026-06-29.
    const wed = new Date(2026, 6, 1);
    const start = weekStartLocal(wed);
    expect([start.getMonth(), start.getDate()]).toEqual([5, 29]);
  });

  it("crosses a year boundary", () => {
    // 2026-01-01 is a Thursday → week starts Monday 2025-12-29.
    const thu = new Date(2026, 0, 1);
    const start = weekStartLocal(thu);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2025, 11, 29,
    ]);
  });
});

describe("monthStartLocal", () => {
  it("returns local midnight on the 1st", () => {
    const d = new Date(2026, 6, 8, 9, 45);
    const start = monthStartLocal(d);
    expect([start.getMonth(), start.getDate(), start.getHours()]).toEqual([
      6, 1, 0,
    ]);
  });
});

describe("buildWeekBuckets", () => {
  it("builds ascending contiguous buckets ending with the current week", () => {
    const now = new Date(2026, 6, 8); // Wed Jul 8 → current week starts Jul 6
    const buckets = buildWeekBuckets(6, now);
    expect(buckets).toHaveLength(6);
    expect(buckets[5].start.getDate()).toBe(6);
    expect(buckets[0].start.getDate()).toBe(1); // Jun 1, five weeks earlier
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].start.getTime()).toBe(buckets[i - 1].end.getTime());
    }
  });

  it("labels buckets with uppercase month + day", () => {
    const buckets = buildWeekBuckets(1, new Date(2026, 6, 8));
    expect(buckets[0].label).toMatch(/^JUL 6$/i);
    expect(buckets[0].label).toBe(buckets[0].label.toUpperCase());
  });
});

describe("bucketMsByWeek", () => {
  const now = new Date(2026, 6, 8);
  const buckets = buildWeekBuckets(2, now); // Jun 29 week, Jul 6 week

  it("assigns an entry to the week of its local start", () => {
    const totals = bucketMsByWeek(
      [
        {
          started_at: localISO(2026, 7, 7, 10),
          ended_at: localISO(2026, 7, 7, 12),
        },
      ],
      buckets,
    );
    expect(totals[1]).toBe(2 * 60 * 60 * 1000);
    expect(totals[0]).toBe(0);
  });

  it("keeps a Sunday-night entry in its local week (UTC boundary trap)", () => {
    // Sunday Jul 5, 11pm local — belongs to the Jun 29 week even though the
    // UTC timestamp may already read Monday.
    const totals = bucketMsByWeek(
      [
        {
          started_at: localISO(2026, 7, 5, 23),
          ended_at: localISO(2026, 7, 5, 23, 30),
        },
      ],
      buckets,
    );
    expect(totals[0]).toBe(30 * 60 * 1000);
    expect(totals[1]).toBe(0);
  });

  it("ignores entries outside every bucket", () => {
    const totals = bucketMsByWeek(
      [
        {
          started_at: localISO(2026, 5, 1, 10),
          ended_at: localISO(2026, 5, 1, 11),
        },
      ],
      buckets,
    );
    expect(totals).toEqual([0, 0]);
  });
});

describe("computeFunnel", () => {
  const now = new Date(2026, 6, 8);
  const idea = (status: IdeaStatus) => ({ status });
  const project = (status: ProjectStatus) => ({ status });

  it("counts the four stages from real rows", () => {
    const funnel = computeFunnel(
      [idea("draft"), idea("validating"), idea("validating"), idea("promoted")],
      [project("active"), project("active"), project("completed")],
      [
        { status: "inprogress", updated_at: localISO(2026, 7, 7) },
        { status: "done", updated_at: localISO(2026, 7, 2) },
        // Done last month — not "shipped this month".
        { status: "done", updated_at: localISO(2026, 6, 20) },
        { status: "backlog", updated_at: localISO(2026, 7, 1) },
      ],
      now,
    );
    expect(funnel).toEqual({
      captured: 4,
      validating: 2,
      building: 3, // 2 active projects + 1 inprogress task
      shipped: 2, // 1 completed project + 1 done-this-month task
      includesTasks: true,
    });
  });

  it("degrades to ideas + projects when tasks are unavailable", () => {
    const funnel = computeFunnel(
      [idea("validating")],
      [project("active"), project("completed")],
      null,
      now,
    );
    expect(funnel).toEqual({
      captured: 1,
      validating: 1,
      building: 1,
      shipped: 1,
      includesTasks: false,
    });
  });

  it("is all zeros on an empty workspace", () => {
    const funnel = computeFunnel([], [], null, now);
    expect(funnel.captured + funnel.validating + funnel.building + funnel.shipped).toBe(0);
  });
});
