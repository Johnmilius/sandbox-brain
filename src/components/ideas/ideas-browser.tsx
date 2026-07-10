"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { createIdea } from "@/app/ideas/actions";
import {
  DIMS,
  IDEA_ACCENT,
  STAGES,
  avgScore,
  ratedCount,
  scoreColor,
  sourceDomain,
  verdictMeta,
} from "@/components/ideas/idea-meta";
import type { IdeaScores, IdeaStatus, IdeaVerdict } from "@/lib/database.types";

/**
 * Ideas list — design `Sandbox Brain Ideas.dc.html`: quick-capture bar,
 * stage filter chips with counts, filter search, and grid cards carrying a
 * lifecycle track + 7-bar score sparkline + big average.
 */

export type IdeaCardVM = {
  id: string;
  title: string;
  tagline: string | null;
  status: IdeaStatus;
  verdict: IdeaVerdict | null;
  scores: IdeaScores;
  updatedLabel: string;
  promotedName: string | null;
  relatedCount: number;
  sourceUrl: string | null;
};

const SEED_PROMPTS = [
  "What problem keeps coming up?",
  "A tool you wish existed",
  "Something the team keeps rebuilding",
];

type StageFilter = "all" | IdeaStatus;

const STAGE_CHIPS: { id: StageFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "validating", label: "Validating" },
  { id: "promoted", label: "Promoted" },
  { id: "archived", label: "Archived" },
];

export function IdeasBrowser({ ideas }: { ideas: IdeaCardVM[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<StageFilter>("all");
  const [query, setQuery] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTagline, setQuickTagline] = useState("");
  const [pending, startTransition] = useTransition();

  const canCreate = quickTitle.trim().length > 0 && !pending;

  function capture() {
    if (!canCreate) return;
    startTransition(async () => {
      const { id, error } = await createIdea({
        title: quickTitle,
        tagline: quickTagline,
      });
      if (error || !id) {
        toast.error(error ?? "Couldn't capture the idea.");
      } else {
        setQuickTitle("");
        setQuickTagline("");
        router.push(`/ideas/${id}`);
      }
    });
  }

  const counts = useMemo(() => {
    const byStage = new Map<StageFilter, number>([["all", ideas.length]]);
    for (const chip of STAGE_CHIPS.slice(1)) {
      byStage.set(chip.id, ideas.filter((i) => i.status === chip.id).length);
    }
    return byStage;
  }, [ideas]);

  const q = query.trim().toLowerCase();
  const filtered = ideas.filter((i) => {
    if (stage !== "all" && i.status !== stage) return false;
    if (!q) return true;
    return `${i.title} ${i.tagline ?? ""}`.toLowerCase().includes(q);
  });

  // ---- Empty state (no ideas at all) — centered capture card ----
  if (ideas.length === 0) {
    return (
      <div className="mx-auto max-w-[430px] pt-10 text-center">
        <div
          className="mx-auto mb-5 flex size-16 items-center justify-center rounded-[18px] text-[30px]"
          style={{ backgroundColor: "#f2ecfd", color: IDEA_ACCENT }}
        >
          ◇
        </div>
        <h2 className="font-display mb-2 text-[26px] text-[var(--v2-ink-1)]">
          No ideas captured yet
        </h2>
        <p className="mb-7 text-[14px] leading-relaxed text-[var(--v2-ink-2)]">
          This is where early startup concepts live — lighter than a project.
          Jot a title and a one-line pitch; you can flesh out the problem,
          customer, and scores whenever you come back to it.
        </p>
        <div
          className="rounded-[14px] text-left"
          style={{
            backgroundColor: "var(--v2-rail-bg)",
            border: "1px solid #ededeb",
            padding: "18px 18px 16px",
            boxShadow: "0 6px 20px -14px rgba(0,0,0,.25)",
          }}
        >
          <p className="font-mono-label mb-2.5">Capture an idea</p>
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="Title — what's the idea?"
            className="mb-2.5 w-full border-b bg-transparent pb-2.5 text-[18px] font-medium text-[var(--v2-ink-1)] outline-none placeholder:text-[var(--v2-ink-4)]"
            style={{ borderColor: "#ededeb" }}
          />
          <input
            value={quickTagline}
            onChange={(e) => setQuickTagline(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="One-line pitch (optional)"
            className="mb-3.5 w-full bg-transparent text-[13.5px] text-[#57534e] outline-none placeholder:text-[var(--v2-ink-4)]"
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={capture}
              className="rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors"
              style={{
                backgroundColor: canCreate ? "#1c1c1f" : "#efece7",
                color: canCreate ? "#fff" : "#c4c1ba",
                cursor: canCreate ? "pointer" : "default",
              }}
            >
              Capture idea →
            </button>
            <span className="text-[11.5px] text-[var(--v2-ink-label)]">
              Enter to save · opens straight into the canvas
            </span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SEED_PROMPTS.map((seed) => (
            <button
              key={seed}
              type="button"
              onClick={() => setQuickTitle(seed)}
              className="rounded-[14px] px-3 py-1.5 text-[11.5px] text-[var(--v2-ink-2)] transition-colors hover:bg-[#efece7]"
              style={{ backgroundColor: "#f6f4f1" }}
            >
              {seed}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* quick capture bar */}
      <div
        className="mb-5 flex items-center gap-3 rounded-[12px]"
        style={{
          backgroundColor: "var(--v2-rail-bg)",
          border: "1px solid #ededeb",
          padding: "11px 13px",
        }}
      >
        <span
          className="flex size-[30px] flex-none items-center justify-center rounded-[8px] text-[15px]"
          style={{ backgroundColor: "#f2ecfd", color: IDEA_ACCENT }}
        >
          ◇
        </span>
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
          placeholder="Capture a new idea — just a title to start…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--v2-ink-1)] outline-none placeholder:text-[var(--v2-ink-3)]"
        />
        <input
          value={quickTagline}
          onChange={(e) => setQuickTagline(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && capture()}
          placeholder="one-line pitch"
          className="hidden w-[220px] flex-none border-l bg-transparent pl-3 text-[13px] text-[#57534e] outline-none placeholder:text-[var(--v2-ink-3)] sm:block"
          style={{ borderColor: "#ededeb" }}
        />
        <button
          type="button"
          onClick={capture}
          className="flex-none rounded-[9px] px-[15px] py-2 text-[12.5px] font-medium transition-colors"
          style={{
            backgroundColor: canCreate ? "#1c1c1f" : "#efece7",
            color: canCreate ? "#fff" : "#c4c1ba",
            cursor: canCreate ? "pointer" : "default",
          }}
        >
          Add
        </button>
      </div>

      {/* stage chips + filter search */}
      <div className="mb-[18px] flex flex-wrap items-center gap-1.5">
        {STAGE_CHIPS.map((chip) => {
          const active = stage === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStage(chip.id)}
              className="flex items-center gap-[7px] rounded-[14px] px-3 py-[5px] text-[12px] transition-colors"
              style={{
                backgroundColor: active ? "#1c1c1f" : "#f4f2ef",
                color: active ? "#fff" : "#78716c",
                fontWeight: active ? 500 : 400,
              }}
            >
              {chip.label}
              <span className="font-mono text-[10px] opacity-70">
                {counts.get(chip.id) ?? 0}
              </span>
            </button>
          );
        })}
        <div
          className="ml-auto flex h-[30px] w-[180px] items-center gap-[7px] rounded-[8px] px-2.5"
          style={{ backgroundColor: "#f6f4f1" }}
        >
          <Search className="size-3 shrink-0 text-[var(--v2-ink-label)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter ideas"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#57534e] outline-none placeholder:text-[var(--v2-ink-3)]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-[54px] text-center text-[var(--v2-ink-4)]">
          <div className="mb-2.5 text-[28px]">◇</div>
          <div className="text-[13.5px] text-[var(--v2-ink-3)]">
            {q
              ? `No ideas match “${query}”.`
              : `Nothing in ${stage} yet.`}
          </div>
        </div>
      ) : (
        <div
          className="grid gap-[15px]"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(292px, 1fr))",
          }}
        >
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onOpen={() => router.push(`/ideas/${idea.id}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function IdeaCard({ idea, onOpen }: { idea: IdeaCardVM; onOpen: () => void }) {
  const vm = verdictMeta(idea.verdict);
  const avg = avgScore(idea.scores);
  const rated = ratedCount(idea.scores);
  const archived = idea.status === "archived";
  const stageIdx = STAGES.findIndex((s) => s.key === idea.status);
  const hasMeta =
    idea.status === "promoted" || idea.relatedCount > 0 || !!idea.sourceUrl;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex cursor-pointer flex-col rounded-[13px] bg-white text-left transition-all hover:-translate-y-px hover:border-[#e2ddd4] hover:shadow-[0_6px_18px_-10px_rgba(0,0,0,0.18)]"
      style={{ border: "1px solid #ededeb", padding: "16px 17px 15px" }}
    >
      <div className="mb-[11px] flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-[20px] text-[11px] font-medium"
          style={{
            backgroundColor: vm.bg,
            color: vm.color,
            padding: "3px 9px 3px 8px",
          }}
        >
          <span
            className="size-[7px] rounded-full"
            style={{ backgroundColor: vm.dot }}
          />
          {vm.label}
        </span>
        <span className="font-mono text-[10px] text-[var(--v2-ink-label)]">
          {idea.updatedLabel}
        </span>
      </div>

      <div className="mb-[3px] text-[15.5px] leading-[1.25] font-semibold text-[var(--v2-ink-1)]">
        {idea.title}
      </div>
      <div className="mb-3.5 line-clamp-2 min-h-[18px] text-[12.5px] leading-[1.45] text-[var(--v2-ink-2)]">
        {idea.tagline || "No pitch yet"}
      </div>

      {/* lifecycle track */}
      <div className="mb-[15px] flex items-center">
        {STAGES.map((s, i) => {
          const done = !archived && i < stageIdx;
          const current = !archived && i === stageIdx;
          const col = STAGE_COLOR_TRACK[s.key] ?? "#a8a29e";
          return (
            <span key={s.key} className="contents">
              {i > 0 && (
                <span
                  className="h-0.5 flex-1"
                  style={{
                    backgroundColor:
                      !archived && i <= stageIdx ? col : "#e7e5e0",
                  }}
                />
              )}
              <span className="flex items-center gap-[5px]">
                <span
                  className="size-[9px] rounded-full"
                  style={{
                    backgroundColor: done || current ? col : "#fff",
                    border: `1.5px solid ${done || current ? col : "#d6d1c9"}`,
                  }}
                />
                <span
                  className="font-mono text-[9px] tracking-[0.02em]"
                  style={{
                    color: current ? col : done ? "#78716c" : "#c4c1ba",
                    fontWeight: current ? 600 : 400,
                  }}
                >
                  {s.label.toUpperCase()}
                </span>
              </span>
            </span>
          );
        })}
      </div>

      {/* score sparkline + average */}
      <div
        className="mt-auto flex items-end justify-between border-t pt-[13px]"
        style={{ borderColor: "#f4f2ef" }}
      >
        <div className="flex h-[26px] items-end gap-[3px]">
          {DIMS.map((d) => {
            const v = idea.scores[d.key];
            return (
              <span
                key={d.key}
                title={d.label}
                className="w-1.5 rounded-[2px]"
                style={{
                  backgroundColor: v ? IDEA_ACCENT : "#e7e5e0",
                  height: v ? Math.max(5, (v / 5) * 26) : 4,
                }}
              />
            );
          })}
        </div>
        <div className="text-right">
          <div className="text-[15px] leading-none font-semibold">
            <span style={{ color: scoreColor(avg) }}>
              {avg == null ? "–" : avg.toFixed(1)}
            </span>
            <span className="font-mono text-[10px] font-normal text-[var(--v2-ink-4)]">
              /5
            </span>
          </div>
          <div className="font-mono mt-[3px] text-[9px] text-[var(--v2-ink-label)]">
            {rated} of 7 rated
          </div>
        </div>
      </div>

      {hasMeta && (
        <div className="font-mono mt-[11px] flex items-center gap-3 text-[10.5px] text-[var(--v2-ink-3)]">
          {idea.status === "promoted" && idea.promotedName && (
            <span style={{ color: "#3f7a56" }}>→ {idea.promotedName}</span>
          )}
          {idea.relatedCount > 0 && <span>◍ {idea.relatedCount} related</span>}
          {idea.sourceUrl && <span>⎘ {sourceDomain(idea.sourceUrl)}</span>}
        </div>
      )}
    </button>
  );
}

/** Track colors keyed by stage (design stageColor()). */
const STAGE_COLOR_TRACK: Record<string, string> = {
  draft: "#a8a29e",
  validating: "#c68a1e",
  promoted: "#3f7a56",
};
