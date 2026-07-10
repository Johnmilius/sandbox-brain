import "../index.css";

import { useToolInfo } from "../helpers.js";
import type { DashboardData, ProjectBar } from "../summary.js";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="mono-label">{label}</p>
      <p className="kpi-value">
        {value}
        <span className="kpi-unit">h</span>
      </p>
    </div>
  );
}

function StackedBar({ bar, max }: { bar: ProjectBar; max: number }) {
  return (
    <div className="bar-row">
      <span className="bar-name">{bar.project}</span>
      <div className="bar-track">
        {bar.slices.map((s) => (
          <div
            key={s.email}
            className="bar-slice"
            title={`${s.name}: ${s.hours}h`}
            style={{
              width: `${(s.hours / max) * 100}%`,
              backgroundColor: s.color,
            }}
          />
        ))}
      </div>
      <span className="bar-total">{bar.total}h</span>
    </div>
  );
}

function Dashboard() {
  const { output, isPending } = useToolInfo<"brain_dashboard">();

  if (isPending) {
    return <div className="state">Loading the week…</div>;
  }
  const data = output as DashboardData | undefined;
  // isError tool results carry no structuredContent, so `output` can be a
  // truthy non-dashboard object — validate the shape, not just truthiness.
  if (
    !data ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.people) ||
    !Array.isArray(data.activeTimers) ||
    typeof data.windowStartIso !== "string" ||
    typeof data.teamHours !== "number"
  ) {
    return <div className="state">Couldn&apos;t load dashboard data.</div>;
  }
  const maxProject = Math.max(...data.projects.map((p) => p.total), 1);
  const sinceLabel = new Date(data.windowStartIso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-eyebrow-row">
          <span className="mono-label">Sandbox Brain</span>
          <span className="mono-label">since {sinceLabel}</span>
        </div>
        <h1 className="dash-title">This week</h1>
        <p className="dash-sub">
          Team logged {data.teamHours}h in the last 7 days.
        </p>
      </header>

      <div className="kpi-grid">
        <Kpi label="Team hours" value={`${data.teamHours}`} />
        {data.people.map((p) => (
          <Kpi key={p.email} label={p.name} value={`${p.hours}`} />
        ))}
      </div>

      <section className="card">
        <div className="chart-head">
          <p className="mono-label">Hours by project</p>
          {data.people.length > 0 && (
            <div className="legend">
              {data.people.map((p) => (
                <span key={p.email} className="legend-item">
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {data.projects.length === 0 ? (
          <div className="state">No time logged this week yet.</div>
        ) : (
          <div className="bars">
            {data.projects.map((bar) => (
              <StackedBar key={bar.project} bar={bar} max={maxProject} />
            ))}
          </div>
        )}
      </section>

      {data.activeTimers.length > 0 && (
        <section className="card">
          <p className="mono-label">Running now</p>
          <div className="timer-rows">
            {data.activeTimers.map((t) => (
              <p key={`${t.name}-${t.startedAt}`} className="timer-row">
                <span className="timer-pulse" />
                {t.name} · {t.project} · since{" "}
                {new Date(t.startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
