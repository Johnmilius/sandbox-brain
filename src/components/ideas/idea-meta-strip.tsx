"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { patchIdea } from "@/app/ideas/actions";
import {
  STAGES,
  STAGE_COLOR,
  sourceDomain,
  verdictMeta,
} from "@/components/ideas/idea-meta";
import type { IdeaStatus, IdeaVerdict } from "@/lib/database.types";

/**
 * Detail meta strip — design: clickable verdict pills (Strong/Conditional/
 * Pass), the 3-step lifecycle stepper (✓ done / filled current / hollow
 * future), ARCHIVED badge, source link, and the archive toggle.
 */

const VERDICTS: IdeaVerdict[] = ["strong", "conditional", "pass"];

export function IdeaMetaStrip({
  ideaId,
  verdict,
  status,
  sourceUrl,
}: {
  ideaId: string;
  verdict: IdeaVerdict | null;
  status: IdeaStatus;
  sourceUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const archived = status === "archived";
  const stageIdx = STAGES.findIndex((s) => s.key === status);

  function patch(input: Parameters<typeof patchIdea>[1]) {
    startTransition(async () => {
      const { error } = await patchIdea(ideaId, input);
      if (error) toast.error(error);
      else router.refresh();
    });
  }

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-x-[22px] gap-y-4 border-b"
      style={{ borderColor: "#f0eeeb", padding: "16px 0 20px" }}
    >
      {/* verdict pills */}
      <div>
        <p className="font-mono mb-[7px] text-[9px] tracking-[0.12em] text-[var(--v2-ink-label)] uppercase">
          Verdict
        </p>
        <div className="flex gap-[5px]">
          {VERDICTS.map((v) => {
            const m = verdictMeta(v);
            const on = verdict === v;
            return (
              <button
                key={v}
                type="button"
                disabled={pending}
                onClick={() => patch({ verdict: on ? null : v })}
                className="flex cursor-pointer items-center gap-1.5 rounded-[8px] px-[11px] py-[5px] text-[11.5px] transition-colors"
                style={{
                  backgroundColor: on ? m.bg : "#fff",
                  color: on ? m.color : "#a8a29e",
                  border: `1px solid ${on ? m.border : "#ededeb"}`,
                  fontWeight: on ? 600 : 500,
                }}
              >
                <span
                  className="size-[7px] rounded-full"
                  style={{ backgroundColor: m.dot }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* lifecycle stepper */}
      <div>
        <p className="font-mono mb-[7px] text-[9px] tracking-[0.12em] text-[var(--v2-ink-label)] uppercase">
          Lifecycle
        </p>
        <div className="flex items-center">
          {STAGES.map((s, i) => {
            const done = !archived && i < stageIdx;
            const current = !archived && i === stageIdx;
            const col = STAGE_COLOR[s.key];
            // Promotion goes through the promote banner (creates the
            // project); the stepper only moves between draft/validating.
            const clickable = s.key !== "promoted" && !pending;
            return (
              <span key={s.key} className="contents">
                {i > 0 && (
                  <span
                    className="h-0.5 w-[26px]"
                    style={{
                      backgroundColor:
                        !archived && i <= stageIdx ? col : "#e7e5e0",
                    }}
                  />
                )}
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() =>
                    clickable && patch({ status: s.key as IdeaStatus })
                  }
                  title={
                    s.key === "promoted"
                      ? "Use the promote banner to create the project"
                      : undefined
                  }
                  className="flex items-center gap-1.5 px-1 py-0.5"
                  style={{ cursor: clickable ? "pointer" : "default" }}
                >
                  <span
                    className="flex size-4 items-center justify-center rounded-full text-[9px] text-white"
                    style={{
                      backgroundColor: done || current ? col : "#fff",
                      border: `1.5px solid ${done || current ? col : "#d6d1c9"}`,
                    }}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span
                    className="text-[11.5px]"
                    style={{
                      color: current ? col : done ? "#78716c" : "#c4c1ba",
                      fontWeight: current ? 600 : 400,
                    }}
                  >
                    {s.label}
                  </span>
                </button>
              </span>
            );
          })}
          {archived && (
            <span
              className="font-mono ml-3 rounded-[6px] px-2 py-[3px] text-[10.5px]"
              style={{ backgroundColor: "#f4f2ef", color: "#a8a29e" }}
            >
              ARCHIVED
            </span>
          )}
        </div>
      </div>

      {/* source + archive toggle */}
      <div className="ml-auto flex items-end gap-4">
        <div>
          <p className="font-mono mb-[7px] text-[9px] tracking-[0.12em] text-[var(--v2-ink-label)] uppercase">
            Source
          </p>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] hover:underline"
              style={{ color: "var(--v2-accent-purple)" }}
            >
              ⎘ {sourceDomain(sourceUrl)}
            </a>
          ) : (
            <span className="text-[12px] text-[var(--v2-ink-4)]">—</span>
          )}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            patch({ status: archived ? "draft" : "archived" })
          }
          className="font-mono cursor-pointer pb-0.5 text-[10px] text-[var(--v2-ink-4)] transition-colors hover:text-[var(--v2-danger)]"
        >
          {archived ? "restore idea" : "archive idea"}
        </button>
      </div>
    </div>
  );
}
