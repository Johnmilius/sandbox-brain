import "../index.css";

import { useToolInfo } from "../helpers.js";
import type { DashboardData, ProjectBar } from "../summary.js";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {sub ? <p className="kpi-sub">{sub}</p> : null}
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

  return (
    <div className="dash">
      <header className="dash-header">
        <h1>Sandbox Brain</h1>
        <span className="dash-sub">
          last 7 days · since {new Date(data.windowStartIso).toLocaleDateString()}
        </span>
      </header>

      <div className="kpi-grid">
        <Kpi label="Team hours" value={`${data.teamHours}`} />
        {data.people.map((p) => (
          <Kpi key={p.email} label={p.name} value={`${p.hours}`} />
        ))}
      </div>

      {data.people.length > 0 && (
        <div className="legend">
          {data.people.map((p) => (
            <span key={p.email} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      )}

      {data.projects.length === 0 ? (
        <div className="state">No time logged this week yet.</div>
      ) : (
        <div className="bars">
          {data.projects.map((bar) => (
            <StackedBar key={bar.project} bar={bar} max={maxProject} />
          ))}
        </div>
      )}

      {data.activeTimers.length > 0 && (
        <div className="timers">
          <p className="timers-title">Running now</p>
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
      )}
    </div>
  );
}

export default Dashboard;
