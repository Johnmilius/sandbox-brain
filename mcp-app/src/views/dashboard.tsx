import "../index.css";

import { useEffect, useState } from "react";

import { useToolInfo } from "../helpers.js";
import type {
  ActiveTimer,
  DashboardData,
  PersonSlice,
  ProjectBar,
} from "../summary.js";

/** "Luke Moffat" → "LM"; single-word names → first two letters. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Pick ink or white for text on a colored avatar so contrast always holds. */
function readableOn(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#ffffff";
  const chan = (i: number) => parseInt(c.slice(i, i + 2), 16) / 255;
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(chan(0)) + 0.7152 * lin(chan(2)) + 0.0722 * lin(chan(4));
  return L > 0.45 ? "#1c1c1f" : "#ffffff";
}

function elapsedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="avatar"
      style={{ backgroundColor: color, color: readableOn(color) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function PersonRow({
  person,
  max,
  ready,
  index,
}: {
  person: PersonSlice;
  max: number;
  ready: boolean;
  index: number;
}) {
  return (
    <li className="person-row">
      <Avatar name={person.name} color={person.color} />
      <div className="person-meta">
        <div className="person-line">
          <span className="person-name">{person.name}</span>
          <span className="person-hours">{person.hours}h</span>
        </div>
        <div className="person-track">
          <div
            className="person-fill"
            style={{
              width: ready ? `${(person.hours / max) * 100}%` : 0,
              backgroundColor: person.color,
              transitionDelay: `${index * 70}ms`,
            }}
          />
        </div>
      </div>
    </li>
  );
}

function ProjectRow({
  bar,
  max,
  ready,
  index,
}: {
  bar: ProjectBar;
  max: number;
  ready: boolean;
  index: number;
}) {
  return (
    <li className="bar-row">
      <span className="bar-name">{bar.project}</span>
      <span className="bar-total">{bar.total}h</span>
      <div className="bar-track">
        {bar.slices.map((s, si) => (
          <div
            key={s.email}
            className="bar-slice"
            title={`${s.name}: ${s.hours}h`}
            style={{
              width: ready ? `${(s.hours / max) * 100}%` : 0,
              backgroundColor: s.color,
              transitionDelay: `${index * 70 + si * 40}ms`,
            }}
          />
        ))}
      </div>
    </li>
  );
}

function RunningRow({
  timer,
  colorByName,
  now,
}: {
  timer: ActiveTimer;
  colorByName: Map<string, string>;
  now: number;
}) {
  const color = colorByName.get(timer.name) ?? "#1c1c1f";
  const elapsed = elapsedLabel(now - new Date(timer.startedAt).getTime());
  return (
    <li className="run-row">
      <Avatar name={timer.name} color={color} />
      <span className="run-who">
        {timer.name} <span className="run-proj">· {timer.project}</span>
      </span>
      <span className="run-elapsed">{elapsed}</span>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="dash">
      <div className="skeleton">
        <div className="sk sk-title" />
        <div className="sk sk-line" />
        <div className="sk sk-line" />
        <div className="sk sk-line short" />
      </div>
    </div>
  );
}

function Dashboard() {
  const { output, isPending } = useToolInfo<"brain_dashboard">();

  // Draw-in for bars: mount at 0, expand to target on the next frame.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Live clock for running timers — ticks once a second while any are active.
  const data = output as DashboardData | undefined;
  const hasTimers = Array.isArray(data?.activeTimers) && data.activeTimers.length > 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasTimers) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimers]);

  if (isPending) {
    return <Skeleton />;
  }

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
    return (
      <div className="dash">
        <div className="state">Couldn&apos;t load dashboard data.</div>
      </div>
    );
  }

  const maxProject = Math.max(...data.projects.map((p) => p.total), 1);
  const maxPerson = Math.max(...data.people.map((p) => p.hours), 1);
  const colorByName = new Map(data.people.map((p) => [p.name, p.color]));
  const sinceLabel = new Date(data.windowStartIso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();

  return (
    <div className="dash">
      <header className="lede">
        <div className="eyebrow-row">
          <span className="mono-label">Sandbox Brain</span>
          <span className="mono-label">7 days · since {sinceLabel}</span>
        </div>
        <div className="lede-body">
          <h1 className="lede-figure">
            <span className="lede-number">{data.teamHours}</span>
            <span className="lede-unit">h</span>
          </h1>
          <p className="lede-caption">logged across the team this week</p>
        </div>
      </header>

      {data.people.length > 0 && (
        <section className="section">
          <p className="mono-label">By person</p>
          <ul className="person-list">
            {data.people.map((p, i) => (
              <PersonRow
                key={p.email}
                person={p}
                max={maxPerson}
                ready={ready}
                index={i}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="section-head">
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
          <p className="empty-bars">No time logged this week yet.</p>
        ) : (
          <ul className="bars">
            {data.projects.map((bar, i) => (
              <ProjectRow
                key={bar.project}
                bar={bar}
                max={maxProject}
                ready={ready}
                index={i}
              />
            ))}
          </ul>
        )}
      </section>

      {data.activeTimers.length > 0 && (
        <section className="running">
          <div className="running-head">
            <span className="timer-pulse" />
            <p className="mono-label">Running now</p>
          </div>
          <ul className="run-list">
            {data.activeTimers.map((t) => (
              <RunningRow
                key={`${t.name}-${t.startedAt}`}
                timer={t}
                colorByName={colorByName}
                now={now}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
