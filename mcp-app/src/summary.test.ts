import { describe, expect, it } from "vitest";
import {
  buildDashboardSummary,
  PERSON_COLORS,
  type TimeEntryRow,
} from "./summary.js";

const NOW = new Date("2026-07-06T18:00:00Z");

function row(overrides: Partial<TimeEntryRow>): TimeEntryRow {
  return {
    started_at: "2026-07-06T10:00:00Z",
    ended_at: "2026-07-06T12:00:00Z",
    profiles: { email: "luke@test.com", full_name: "Luke Moffat" },
    projects: { name: "Acme CRM" },
    ...overrides,
  };
}

describe("buildDashboardSummary", () => {
  it("returns all-zero data for no rows", () => {
    const data = buildDashboardSummary([], NOW);
    expect(data.teamHours).toBe(0);
    expect(data.people).toEqual([]);
    expect(data.projects).toEqual([]);
    expect(data.activeTimers).toEqual([]);
    expect(data.windowStartIso).toBe("2026-06-29T18:00:00.000Z");
  });

  it("sums completed hours per person and project", () => {
    const data = buildDashboardSummary(
      [
        row({}), // Luke, Acme CRM, 2h
        row({ started_at: "2026-07-05T09:00:00Z", ended_at: "2026-07-05T10:30:00Z" }), // Luke, 1.5h
        row({
          profiles: { email: "john@test.com", full_name: "John Milius" },
          projects: { name: "Pitch deck" },
          started_at: "2026-07-04T13:00:00Z",
          ended_at: "2026-07-04T16:00:00Z",
        }), // John, 3h
      ],
      NOW,
    );
    expect(data.teamHours).toBe(6.5);
    expect(data.people).toHaveLength(2);
    expect(data.people[0]).toMatchObject({ email: "luke@test.com", hours: 3.5 }); // sorted desc
    expect(data.people[1]).toMatchObject({ email: "john@test.com", hours: 3 });
    const acme = data.projects.find((p) => p.project === "Acme CRM");
    expect(acme?.total).toBe(3.5);
    expect(acme?.slices[0]).toMatchObject({ email: "luke@test.com", hours: 3.5 });
  });

  it("ignores entries that started before the 7-day window", () => {
    const data = buildDashboardSummary(
      [row({ started_at: "2026-06-20T10:00:00Z", ended_at: "2026-06-20T12:00:00Z" })],
      NOW,
    );
    expect(data.teamHours).toBe(0);
    expect(data.projects).toEqual([]);
  });

  it("lists running timers without counting their hours", () => {
    const data = buildDashboardSummary([row({ ended_at: null })], NOW);
    expect(data.teamHours).toBe(0);
    expect(data.activeTimers).toEqual([
      { name: "Luke Moffat", project: "Acme CRM", startedAt: "2026-07-06T10:00:00Z" },
    ]);
  });

  it("skips rows with missing profile or project", () => {
    const data = buildDashboardSummary(
      [row({ profiles: null }), row({ projects: null })],
      NOW,
    );
    expect(data.teamHours).toBe(0);
    expect(data.activeTimers).toEqual([]);
  });

  it("falls back to the email prefix when full_name is missing", () => {
    const data = buildDashboardSummary(
      [row({ profiles: { email: "t3@test.com", full_name: null } })],
      NOW,
    );
    expect(data.people[0].name).toBe("t3");
  });

  it("assigns colors by alphabetical email order, independent of row order", () => {
    const john = row({
      profiles: { email: "john@test.com", full_name: "John" },
    });
    const luke = row({});
    const a = buildDashboardSummary([john, luke], NOW);
    const b = buildDashboardSummary([luke, john], NOW);
    const colorOf = (d: typeof a, email: string) =>
      d.people.find((p) => p.email === email)?.color;
    expect(colorOf(a, "john@test.com")).toBe(PERSON_COLORS[0]); // j < l
    expect(colorOf(a, "luke@test.com")).toBe(PERSON_COLORS[1]);
    expect(colorOf(b, "john@test.com")).toBe(colorOf(a, "john@test.com"));
    expect(colorOf(b, "luke@test.com")).toBe(colorOf(a, "luke@test.com"));
  });

  it("rounds hours to 2 decimals", () => {
    const data = buildDashboardSummary(
      [row({ started_at: "2026-07-06T10:00:00Z", ended_at: "2026-07-06T10:20:00Z" })], // 1/3 h
      NOW,
    );
    expect(data.people[0].hours).toBe(0.33);
  });
});
