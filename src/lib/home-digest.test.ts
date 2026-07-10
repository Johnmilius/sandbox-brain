import { describe, expect, it } from "vitest";
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

function localISO(y: number, m: number, d: number, h = 12, min = 0): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00`;
}

const feedItem = (key: string, at: string): FeedItem => ({
  key,
  actor: "John",
  verb: "updated",
  object: "Thing",
  context: "notes",
  href: "/notes",
  kind: "note",
  at,
});

describe("greetingFor", () => {
  it("maps hours to the three greetings", () => {
    expect(greetingFor(0)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good afternoon");
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
  });
});

describe("monoDate", () => {
  it("formats as WKD · MON D (local)", () => {
    // 2026-07-06 is a Monday.
    expect(monoDate(new Date(2026, 6, 6))).toBe("MON · JUL 6");
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 6, 8, 12, 0);
  it("says just now under a minute", () => {
    expect(relativeTime(localISO(2026, 7, 8, 12, 0), now)).toBe("just now");
  });
  it("rolls to minutes at exactly one minute", () => {
    expect(relativeTime(localISO(2026, 7, 8, 11, 59), now)).toBe("1m ago");
  });
  it("uses minutes under an hour", () => {
    expect(relativeTime(localISO(2026, 7, 8, 11, 46), now)).toBe("14m ago");
  });
  it("uses hours under a day", () => {
    expect(relativeTime(localISO(2026, 7, 8, 9, 0), now)).toBe("3h ago");
  });
  it("uses days beyond that", () => {
    expect(relativeTime(localISO(2026, 7, 6, 12, 0), now)).toBe("2d ago");
  });
});

describe("assembleFeed", () => {
  it("sorts latest first and caps at the limit", () => {
    const items = [
      feedItem("a", localISO(2026, 7, 1)),
      feedItem("b", localISO(2026, 7, 3)),
      feedItem("c", localISO(2026, 7, 2)),
    ];
    const feed = assembleFeed(items, 2);
    expect(feed.map((i) => i.key)).toEqual(["b", "c"]);
  });
});

describe("countSince", () => {
  it("counts items within the last 24h only", () => {
    const now = new Date(2026, 6, 8, 12, 0);
    const items = [
      feedItem("recent", localISO(2026, 7, 8, 9)),
      feedItem("edge", localISO(2026, 7, 7, 13)),
      feedItem("old", localISO(2026, 7, 6, 12)),
    ];
    expect(countSince(items, now)).toBe(2);
  });
});

describe("buildDayBuckets", () => {
  it("builds 7 ascending local days ending today", () => {
    const now = new Date(2026, 6, 8, 15, 30);
    const buckets = buildDayBuckets(now);
    expect(buckets).toHaveLength(7);
    expect(buckets[6].isToday).toBe(true);
    expect(buckets[6].start.getDate()).toBe(8);
    expect(buckets[0].start.getDate()).toBe(2);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].start.getTime()).toBe(buckets[i - 1].end.getTime());
    }
  });

  it("crosses month boundaries with local dates", () => {
    const buckets = buildDayBuckets(new Date(2026, 7, 2)); // Aug 2
    expect(buckets[0].start.getMonth()).toBe(6); // Jul 27
    expect(buckets[0].start.getDate()).toBe(27);
  });
});

describe("bucketMsByDay", () => {
  it("assigns entries to their LOCAL day, incl. late-night starts", () => {
    const now = new Date(2026, 6, 8);
    const buckets = buildDayBuckets(now);
    const totals = bucketMsByDay(
      [
        // 11pm July 7 local — must land on July 7, not UTC-shifted July 8.
        {
          started_at: localISO(2026, 7, 7, 23, 0),
          ended_at: localISO(2026, 7, 7, 23, 30),
        },
        {
          started_at: localISO(2026, 7, 8, 9, 0),
          ended_at: localISO(2026, 7, 8, 10, 0),
        },
      ],
      buckets,
    );
    expect(totals[5]).toBe(30 * 60 * 1000); // Jul 7
    expect(totals[6]).toBe(60 * 60 * 1000); // Jul 8 (today)
  });
});
