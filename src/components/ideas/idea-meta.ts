/**
 * Shared Ideas design constants — extracted from the design source
 * (`Sandbox Brain Ideas.dc.html`): verdict palettes, lifecycle stages,
 * the 7 scoring dimensions, and the score→color scale.
 */

import type { IdeaScores, IdeaStatus, IdeaVerdict } from "@/lib/database.types";

export const IDEA_ACCENT = "#5b3fd6";

export const DIMS: { key: keyof IdeaScores; label: string }[] = [
  { key: "problem", label: "Problem" },
  { key: "market", label: "Market" },
  { key: "revenue", label: "Revenue" },
  { key: "moat", label: "Moat" },
  { key: "distribution", label: "Distribution" },
  { key: "build", label: "Build" },
  { key: "team_fit", label: "Team fit" },
];

export const STAGES: { key: IdeaStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "validating", label: "Validating" },
  { key: "promoted", label: "Promoted" },
];

export type VerdictMeta = {
  label: string;
  color: string;
  bg: string;
  dot: string;
  border: string;
};

const VERDICT_META: Record<IdeaVerdict | "unset", VerdictMeta> = {
  strong: { label: "Strong", color: "#3f7a56", bg: "#eef6f0", dot: "#3f9b6c", border: "#cfe6d8" },
  conditional: { label: "Conditional", color: "#a9761f", bg: "#f8f1e6", dot: "#e0a53f", border: "#ecdcc0" },
  pass: { label: "Pass", color: "#b0442e", bg: "#f7ece8", dot: "#c2410c", border: "#ecd4cb" },
  unset: { label: "No verdict", color: "#a8a29e", bg: "#f4f2ef", dot: "#cfcac2", border: "#e8e4dc" },
};

export function verdictMeta(v: IdeaVerdict | null): VerdictMeta {
  return VERDICT_META[v ?? "unset"];
}

export const STAGE_COLOR: Record<IdeaStatus, string> = {
  draft: "#a8a29e",
  validating: "#c68a1e",
  promoted: "#3f7a56",
  archived: "#a8a29e",
};

export const STAGE_LABEL: Record<IdeaStatus, string> = {
  draft: "Draft",
  validating: "Validating",
  promoted: "Promoted",
  archived: "Archived",
};

export function avgScore(scores: IdeaScores): number | null {
  const vals = Object.values(scores).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function ratedCount(scores: IdeaScores): number {
  return Object.values(scores).filter((v) => v != null).length;
}

/** Score → signal color (design scoreColor()). */
export function scoreColor(avg: number | null): string {
  if (avg == null) return "#c4c1ba";
  if (avg >= 4) return "#3f7a56";
  if (avg >= 3) return IDEA_ACCENT;
  if (avg >= 2) return "#a9761f";
  return "#b0442e";
}

export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}
