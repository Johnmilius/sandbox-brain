import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, selectArgsMock, gteMock, orderMock, selectMock } = vi.hoisted(() => {
  const selectMock = vi.fn();
  const gteMock = vi.fn(() => ({ order: selectMock }));
  const selectArgsMock = vi.fn(() => ({ gte: gteMock }));
  const fromMock = vi.fn(() => ({ select: selectArgsMock }));
  const orderMock = selectMock;
  return { fromMock, selectArgsMock, gteMock, orderMock, selectMock };
});

vi.mock("./supabase.js", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { dashboardHandler } from "./dashboard-tool.js";

describe("dashboardHandler", () => {
  beforeEach(() => {
    selectMock.mockReset();
    fromMock.mockClear();
    selectArgsMock.mockClear();
    gteMock.mockClear();
    // A developer's shell may have BRAIN_DASHBOARD_DEMO=1 exported (e.g. after
    // trying the README's demo command) — force it off so the Supabase-path
    // tests always exercise the query path.
    vi.stubEnv("BRAIN_DASHBOARD_DEMO", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns structured dashboard data on success", async () => {
    selectMock.mockResolvedValue({
      data: [
        {
          started_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
          ended_at: new Date().toISOString(),
          profiles: { email: "luke@test.com", full_name: "Luke" },
          projects: { name: "Acme CRM" },
        },
      ],
      error: null,
    });

    const result = await dashboardHandler();

    expect(result.isError).toBe(false);
    expect(result.structuredContent?.teamHours).toBe(2);
    expect(result.structuredContent?.projects[0].project).toBe("Acme CRM");
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text).teamHours).toBe(2);

    expect(fromMock).toHaveBeenCalledWith("time_entries");
    expect(selectArgsMock).toHaveBeenCalledWith(
      "started_at, ended_at, profiles(email, full_name), projects(name)",
    );
    expect(gteMock).toHaveBeenCalledWith("started_at", expect.any(String));
    expect(orderMock).toHaveBeenCalledWith("started_at", { ascending: false });
  });

  it("returns demo data without touching Supabase when BRAIN_DASHBOARD_DEMO=1", async () => {
    vi.stubEnv("BRAIN_DASHBOARD_DEMO", "1"); // afterEach unstubs

    const result = await dashboardHandler();

    expect(result.isError).toBe(false);
    const data = result.structuredContent;
    expect(data).toBeDefined();
    expect(typeof data!.windowStartIso).toBe("string");
    expect(typeof data!.teamHours).toBe("number");
    expect(data!.teamHours).toBeGreaterThan(0);
    expect(data!.people).toHaveLength(2);
    expect(data!.people.map((p) => p.name).sort()).toEqual([
      "John Milius",
      "Luke Moffat",
    ]);
    expect(data!.projects.length).toBeGreaterThan(0);
    expect(data!.activeTimers).toHaveLength(1);
    expect(data!.activeTimers[0]).toMatchObject({
      name: "John Milius",
      project: "Sandbox Brain",
    });

    // Demo mode must not reach for the Supabase client at all.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns isError with a message when the query fails", async () => {
    selectMock.mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    });

    const result = await dashboardHandler();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain("connection refused");
  });
});
