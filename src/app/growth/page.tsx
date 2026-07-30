import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { getAuthedUser } from "@/lib/supabase/auth";
import {
  bucketMsByWeek,
  buildWeekBuckets,
  computeFunnel,
} from "@/lib/growth";

const TREND_WEEKS = 6;

/** Decimal hours for trend labels, e.g. "4.5h". */
function hoursLabel(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours === 0) return "0h";
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
}

export default async function GrowthPage() {
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect("/login");

  const now = new Date();
  const buckets = buildWeekBuckets(TREND_WEEKS, now);
  const trendCutoff = buckets[0].start.toISOString();

  const [ideasRes, projectsRes, tasksRes, entriesRes] = await Promise.all([
    supabase.from("ideas").select("status"),
    supabase.from("projects").select("status"),
    // Tasks table lands with migration 0007 — degrade gracefully until then.
    supabase.from("tasks").select("status, updated_at"),
    supabase
      .from("time_entries")
      .select("started_at, ended_at")
      .not("ended_at", "is", null)
      .gte("started_at", trendCutoff),
  ]);

  const ideas = ideasRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const tasks = tasksRes.error ? null : (tasksRes.data ?? []);
  const entries = entriesRes.data ?? [];

  const funnel = computeFunnel(ideas, projects, tasks, now);
  const weeklyMs = bucketMsByWeek(entries, buckets);
  const trendMax = Math.max(1, ...weeklyMs);
  const totalTrendMs = weeklyMs.reduce((a, b) => a + b, 0);

  const allZero =
    funnel.captured + funnel.validating + funnel.building + funnel.shipped ===
      0 && totalTrendMs === 0;

  const stages = [
    {
      key: "captured",
      label: "Captured",
      value: funnel.captured,
      caption: "ideas in the hopper",
    },
    {
      key: "validating",
      label: "Validating",
      value: funnel.validating,
      caption: "ideas being tested",
    },
    {
      key: "building",
      label: "Building",
      value: funnel.building,
      caption: funnel.includesTasks
        ? "active projects + tickets"
        : "active projects",
    },
    {
      key: "shipped",
      label: "Shipped",
      value: funnel.shipped,
      caption: funnel.includesTasks
        ? "done this month"
        : "completed projects",
      final: true,
    },
  ];

  // Trend line geometry (server-rendered SVG).
  const W = 560;
  const H = 110;
  const PAD_X = 26;
  const PAD_TOP = 22;
  const PAD_BOTTOM = 8;
  const stepX = (W - PAD_X * 2) / (TREND_WEEKS - 1);
  const points = weeklyMs.map((ms, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_TOP + (1 - ms / trendMax) * (H - PAD_TOP - PAD_BOTTOM),
    ms,
  }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-7">
        <h1
          className="font-display text-[26px] text-[var(--v2-ink-1)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Growth
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
          The idea-to-shipped pipeline, straight from the brain&apos;s own data.
        </p>
      </div>

      {allZero ? (
        <EmptyState
          icon={TrendingUp}
          title="Nothing in the pipeline yet"
          description="Capture an idea, spin up a project, or log some time — the funnel fills itself from real activity."
        />
      ) : (
        <>
          <div className="mb-1 font-mono-label">Pipeline</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stages.map((stage) => (
              <div
                key={stage.key}
                className="rounded-[12px] px-4 py-4"
                style={
                  stage.final
                    ? { backgroundColor: "#1c1c1f" }
                    : {
                        background: "linear-gradient(180deg,#faf8ff,#fff)",
                        border: "1px solid #e6ddf5",
                      }
                }
              >
                <p
                  className="font-mono text-[9.5px] tracking-[0.14em] uppercase"
                  style={{
                    color: stage.final ? "#a8a29e" : "var(--v2-ink-label)",
                  }}
                >
                  {stage.label}
                </p>
                <p
                  className="mt-2 text-[26px] font-semibold tabular-nums"
                  style={{ color: stage.final ? "#ffffff" : "var(--v2-ink-1)" }}
                >
                  {stage.value}
                </p>
                <p
                  className="mt-0.5 text-[11px]"
                  style={{
                    color: stage.final ? "#c4c1ba" : "var(--v2-ink-3)",
                  }}
                >
                  {stage.caption}
                </p>
              </div>
            ))}
          </div>

          <div
            className="mt-6 rounded-[13px] bg-white"
            style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono-label">
                Team hours · last {TREND_WEEKS} weeks
              </p>
              <p className="font-mono text-[10px] text-[var(--v2-ink-3)] tabular-nums">
                {hoursLabel(totalTrendMs)} total
              </p>
            </div>

            {totalTrendMs === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--v2-ink-3)]">
                No time logged in the last {TREND_WEEKS} weeks yet.
              </p>
            ) : (
              <div className="mt-3">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full"
                  role="img"
                  aria-label={`Weekly team hours over the last ${TREND_WEEKS} weeks`}
                >
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke="var(--v2-accent-purple)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {points.map((p, i) => (
                    <g key={buckets[i].label}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="#ffffff"
                        stroke="var(--v2-accent-purple)"
                        strokeWidth="1.8"
                      />
                      <text
                        x={p.x}
                        y={p.y - 9}
                        textAnchor="middle"
                        fontSize="9"
                        fontFamily="var(--font-geist-mono), monospace"
                        fill="var(--v2-ink-3)"
                      >
                        {p.ms > 0 ? hoursLabel(p.ms) : ""}
                      </text>
                    </g>
                  ))}
                </svg>
                <div
                  className="mt-1 flex justify-between"
                  style={{ padding: `0 ${PAD_X - 16}px` }}
                >
                  {buckets.map((b, i) => (
                    <span
                      key={b.label}
                      className="font-mono text-[9.5px] tracking-[0.1em]"
                      style={{
                        color:
                          i === buckets.length - 1
                            ? "var(--v2-ink-1)"
                            : "var(--v2-ink-3)",
                      }}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="mt-5 text-[11px] text-[var(--v2-ink-3)]">
            Definitions are v1 — captured = all ideas · validating = ideas in
            validation · building = active projects
            {funnel.includesTasks ? " + in-progress tickets" : ""} · shipped =
            completed projects
            {funnel.includesTasks ? " + tickets done this month" : ""}. The
            growth lead should evolve these as the funnel gets real.
          </p>
        </>
      )}
    </main>
  );
}
