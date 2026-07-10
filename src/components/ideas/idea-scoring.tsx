"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { patchIdea } from "@/app/ideas/actions";
import {
  DIMS,
  IDEA_ACCENT,
  avgScore,
  scoreColor,
} from "@/components/ideas/idea-meta";
import type { IdeaScores } from "@/lib/database.types";

/**
 * "SCORING · 7 DIMENSIONS" — design radar (SVG spider chart) + directly
 * clickable 1–5 bars. Clicking a cell sets the score; clicking the current
 * value clears it (design setScore()).
 */

const CX = 120;
const CY = 120;
const R = 84;
const N = DIMS.length;

const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
const point = (i: number, f: number): [number, number] => [
  +(CX + Math.cos(angle(i)) * R * f).toFixed(1),
  +(CY + Math.sin(angle(i)) * R * f).toFixed(1),
];

export function IdeaScoring({
  ideaId,
  scores,
}: {
  ideaId: string;
  scores: IdeaScores;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    scores,
    (current, next: IdeaScores) => next,
  );

  function setScore(key: keyof IdeaScores, value: number) {
    const next: IdeaScores = {
      ...optimistic,
      [key]: optimistic[key] === value ? undefined : value,
    };
    startTransition(async () => {
      applyOptimistic(next);
      const { error } = await patchIdea(ideaId, { scores: next });
      if (error) toast.error(error);
      else router.refresh();
    });
  }

  const avg = avgScore(optimistic);

  // Radar geometry (design radarFor()).
  const rings = [1, 2, 3, 4, 5].map((level) => ({
    points: DIMS.map((_, i) => point(i, level / 5).join(",")).join(" "),
    opacity: level === 5 ? 0.6 : 0.3,
  }));
  const spokes = DIMS.map((_, i) => {
    const [x2, y2] = point(i, 1);
    return { x2, y2 };
  });
  const valuePoly = DIMS.map((d, i) =>
    point(i, (optimistic[d.key] ?? 0) / 5).join(","),
  ).join(" ");
  const dots = DIMS.flatMap((d, i) => {
    const v = optimistic[d.key];
    if (!v) return [];
    const [x, y] = point(i, v / 5);
    return [{ x, y }];
  });
  const labels = DIMS.map((d, i) => {
    const [x, rawY] = point(i, 1.19);
    const anchor: "start" | "end" | "middle" =
      x < CX - 4 ? "end" : x > CX + 4 ? "start" : "middle";
    const y = +(rawY + (rawY < CY ? -1 : 5)).toFixed(1);
    return { x, y, anchor, label: d.label };
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono-label">Scoring · 7 dimensions</p>
        <p className="text-[11.5px] text-[var(--v2-ink-3)]">
          Tap the bars to rate 1–5 ·{" "}
          <span className="text-[var(--v2-ink-2)]">
            overall{" "}
            <b style={{ color: scoreColor(avg) }}>
              {avg == null ? "–" : avg.toFixed(1)}
            </b>
            /5
          </span>
        </p>
      </div>
      <div
        className="flex flex-wrap items-center gap-[30px] rounded-[13px]"
        style={{
          border: "1px solid #ededeb",
          padding: "20px 24px",
          backgroundColor: "var(--v2-rail-bg)",
        }}
      >
        <svg
          viewBox="0 0 240 240"
          className="size-[196px] flex-none"
          aria-hidden
        >
          {rings.map((ring, i) => (
            <polygon
              key={i}
              points={ring.points}
              fill="none"
              stroke="#e4e0d9"
              strokeWidth="1"
              opacity={ring.opacity}
            />
          ))}
          {spokes.map((s, i) => (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={s.x2}
              y2={s.y2}
              stroke="#e4e0d9"
              strokeWidth="1"
            />
          ))}
          <polygon
            points={valuePoly}
            fill={`${IDEA_ACCENT}22`}
            stroke={IDEA_ACCENT}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="2.8" fill={IDEA_ACCENT} />
          ))}
          {labels.map((l) => (
            <text
              key={l.label}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              fontSize="8.4"
              fill="#8b857c"
              fontFamily="var(--font-geist-mono), monospace"
            >
              {l.label}
            </text>
          ))}
        </svg>

        <div className="flex min-w-[220px] flex-1 flex-col gap-[11px]">
          {DIMS.map((d) => {
            const v = optimistic[d.key];
            return (
              <div key={d.key} className="flex items-center gap-[13px]">
                <div className="w-[92px] flex-none text-[12px] text-[#57534e]">
                  {d.label}
                </div>
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4, 5].map((cell) => (
                    <button
                      key={cell}
                      type="button"
                      onClick={() => setScore(d.key, cell)}
                      aria-label={`Rate ${d.label} ${cell} of 5`}
                      className="h-[9px] flex-1 cursor-pointer rounded-[3px] transition-[filter] hover:brightness-95"
                      style={{
                        backgroundColor:
                          v != null && cell <= v ? IDEA_ACCENT : "#e7e5e0",
                      }}
                    />
                  ))}
                </div>
                <div
                  className="font-mono w-[18px] flex-none text-right text-[11.5px] font-medium"
                  style={{ color: v != null ? "#57534e" : "#c4c1ba" }}
                >
                  {v ?? "–"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
