import { formatDuration } from "@/lib/format";

type DailyBar = {
  /** Short axis label, e.g. "7/5". */
  label: string;
  /** Full label for the tooltip, e.g. "Sat, Jul 5". */
  fullLabel: string;
  ms: number;
};

const CHART_HEIGHT = 128; // px — the tallest a bar can be

/**
 * Simple CSS bar chart for daily totals. Pure presentational (no client JS) —
 * bars scale to the busiest day and expose exact values on hover.
 */
export function DailyHoursChart({ data }: { data: DailyBar[] }) {
  const max = Math.max(1, ...data.map((d) => d.ms));

  return (
    <div>
      <div
        className="flex items-end gap-1"
        style={{ height: CHART_HEIGHT }}
      >
        {data.map((d) => (
          <div
            key={d.label}
            className="group flex flex-1 items-end"
            title={`${d.fullLabel}: ${formatDuration(d.ms)}`}
          >
            <div
              className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: Math.max(2, Math.round((d.ms / max) * CHART_HEIGHT)) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <span
            key={d.label}
            className="flex-1 text-center text-[10px] text-muted-foreground"
          >
            {/* Thin the labels so 14 days don't collide. */}
            {i % 2 === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
