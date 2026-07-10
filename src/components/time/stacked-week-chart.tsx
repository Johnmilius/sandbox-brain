import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";

/**
 * "HOURS THIS WEEK" — the design's stacked-by-project bar chart
 * (`Sandbox Brain.dc.html` lines 453–499): per-project colored segments,
 * project legend, y-axis gridlines, and a dashed accent average line.
 * Hover on a bar reveals its total (CSS only — stays a server component).
 */

export type WeekChartSegment = { name: string; color: string; ms: number };

export type WeekChartBar = {
  key: string;
  /** Day letter under the bar, e.g. "M". */
  letter: string;
  isToday: boolean;
  totalMs: number;
  /** In legend order — index 0 is drawn at the BOTTOM of the stack. */
  segments: WeekChartSegment[];
};

type StackedWeekChartProps = {
  bars: WeekChartBar[];
  legend: { name: string; color: string }[];
  avgMs: number;
};

const PLOT_HEIGHT = 150;

export function StackedWeekChart({ bars, legend, avgMs }: StackedWeekChartProps) {
  const maxMs = Math.max(1, ...bars.map((b) => b.totalMs));
  const maxHours = maxMs / 3_600_000;

  // Nice y-axis: 3 even steps ending at or above the tallest bar (0/2/4/6h).
  const step = maxHours <= 3 ? 1 : maxHours <= 6 ? 2 : Math.ceil(maxHours / 3);
  const yMaxMs = step * 3 * 3_600_000;
  const yTicks = [0, 1, 2, 3].map((i) => i * step);

  const px = (ms: number) => Math.round((ms / yMaxMs) * PLOT_HEIGHT);
  const avgBottom = px(avgMs);
  const avgHours = (avgMs / 3_600_000).toFixed(1);

  return (
    <div
      className="mb-5 rounded-[13px] bg-white"
      style={{ border: "1px solid #ededeb", padding: "20px 24px 18px" }}
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="font-mono-label">Hours this week</p>
        <div className="flex items-center gap-3.5">
          {legend.map((l) => (
            <div
              key={l.name}
              className="flex items-center gap-1.5 text-[11px] text-[var(--v2-ink-2)]"
            >
              <span
                className="size-[9px] rounded-[3px]"
                style={{ backgroundColor: l.color }}
              />
              {l.name}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {/* y axis */}
        <div
          className="font-mono relative w-6 flex-none text-[9px] text-[var(--v2-ink-4)]"
          style={{ height: PLOT_HEIGHT }}
        >
          {yTicks.map((tick, i) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: PLOT_HEIGHT - px(tick * 3_600_000) }}
            >
              {tick}
              {i === yTicks.length - 1 ? "h" : ""}
            </span>
          ))}
        </div>

        {/* plot */}
        <div className="relative flex-1" style={{ height: PLOT_HEIGHT }}>
          {yTicks.map((tick) => (
            <div
              key={tick}
              className="absolute right-0 left-0 h-px"
              style={{
                top: PLOT_HEIGHT - px(tick * 3_600_000),
                backgroundColor: "#f1efec",
              }}
            />
          ))}

          {avgMs > 0 && (
            <div
              className="absolute right-0 left-0 z-[3] h-0 opacity-55"
              style={{
                bottom: avgBottom,
                borderTop: "1px dashed var(--v2-accent-purple)",
              }}
            >
              <span
                className="font-mono absolute right-0 text-[9px]"
                style={{ top: -14, color: "var(--v2-accent-purple)" }}
              >
                avg {avgHours}h
              </span>
            </div>
          )}

          <div className="absolute inset-0 z-[2] flex items-end gap-2.5">
            {bars.map((bar) => {
              const barH = Math.max(bar.totalMs > 0 ? 3 : 0, px(bar.totalMs));
              return (
                <div
                  key={bar.key}
                  className="group flex h-full flex-1 cursor-default flex-col items-center justify-end"
                  title={formatDuration(bar.totalMs)}
                >
                  <div
                    className={cn(
                      "font-mono mb-[5px] text-[10px] font-medium text-[var(--v2-ink-1)] transition-opacity",
                      bar.isToday
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    {bar.totalMs > 0
                      ? `${(bar.totalMs / 3_600_000).toFixed(1)}h`
                      : ""}
                  </div>
                  <div
                    className="flex w-full max-w-[34px] flex-col overflow-hidden rounded-[5px] transition-[filter] group-hover:brightness-105 group-hover:saturate-105"
                    style={{ height: barH }}
                  >
                    {/* Largest project (legend[0]) sits at the bottom. */}
                    {[...bar.segments].reverse().map((seg) =>
                      seg.ms > 0 ? (
                        <div
                          key={seg.name}
                          style={{
                            height: `${(seg.ms / bar.totalMs) * 100}%`,
                            backgroundColor: seg.color,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* day labels */}
      <div className="mt-2 flex gap-2.5" style={{ paddingLeft: 36 }}>
        {bars.map((bar) => (
          <span
            key={bar.key}
            className="font-mono flex-1 text-center text-[9.5px]"
            style={{
              color: bar.isToday ? "var(--v2-ink-1)" : "var(--v2-ink-3)",
              fontWeight: bar.isToday ? 600 : 400,
            }}
          >
            {bar.letter}
          </span>
        ))}
      </div>
    </div>
  );
}
