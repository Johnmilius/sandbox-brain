"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { fetchFeedPage, type FeedCursor } from "@/app/feed-actions";
import type { FeedItem } from "@/lib/home-digest";

/**
 * The Home "Flowing now" feed — design `Sandbox Brain.dc.html` lines 116–138.
 *
 * - Filter pills (All / Mine / top project): active = black bg/white text,
 *   inactive = #f4f2ef bg / #78716c text.
 * - Twin timeline rails: static 2px #e7e5e0 line + animated dashed overlay
 *   (repeating gradient scrolled by the `flowSlow` keyframe).
 * - Entries: hollow 14px dot ringed in the actor's identity color, actor name
 *   in the same color, object as a kind-tinted chip, `→` context chip.
 */

/** Chip tint per entity kind (bg / fg pairs). */
const KIND_CHIP: Record<FeedItem["kind"], { bg: string; fg: string }> = {
  note: { bg: "#e7ecf7", fg: "#4a5b8a" },
  prompt: { bg: "#f6edd8", fg: "#8a6a2a" },
  time: { bg: "#e3efe7", fg: "#3f7a56" },
  idea: { bg: "#efe9ff", fg: "#5b3fd6" },
  task: { bg: "#fbe9e0", fg: "#a24e2b" },
  project: { bg: "#e9e7e2", fg: "#57534e" },
  knowledge: { bg: "#e2f0f2", fg: "#2f6d77" },
  agent: { bg: "#f0e6f2", fg: "#7a3f85" },
  academy: { bg: "#f6f0d8", fg: "#77662a" },
};

/** Neutral tint for the context (chipB) side of the arrow. */
const CONTEXT_CHIP = { bg: "#f4f2ef", fg: "#57534e" };

export type FlowFeedItem = FeedItem & {
  /** Identity color for the actor (dot ring + name). */
  actorColor: string;
  /** Pre-rendered relative time so server and client agree. */
  timeLabel: string;
};

type FlowingFeedProps = {
  items: FlowFeedItem[];
  currentUserId: string;
  /** Name of the busiest project this week — becomes the third pill. */
  topProject: string | null;
  /** Keyset cursor after the last item; null/absent = no more history. */
  initialCursor?: FeedCursor | null;
};

type FilterId = "all" | "mine" | "project";

export function FlowingFeed({
  items,
  currentUserId,
  topProject,
  initialCursor = null,
}: FlowingFeedProps) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [loaded, setLoaded] = useState<FlowFeedItem[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(initialCursor);
  const [isLoading, startLoading] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    startLoading(async () => {
      const page = await fetchFeedPage(cursor);
      setLoaded((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });
  };

  const pills: { id: FilterId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "Mine" },
    ...(topProject ? [{ id: "project" as const, label: topProject }] : []),
  ];

  const visible = [...items, ...loaded].filter((item) => {
    if (filter === "mine") return item.actorId === currentUserId;
    if (filter === "project") return item.context === topProject;
    return true;
  });

  return (
    <>
      <div className="mt-8 mb-3.5 flex items-center justify-between">
        <p className="font-mono-label">Flowing now</p>
        <div className="flex gap-1">
          {pills.map((pill) => {
            const active = filter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilter(pill.id)}
                className="cursor-pointer rounded-[14px] px-2.5 py-1 text-[11.5px] transition-colors"
                style={{
                  backgroundColor: active ? "#1c1c1f" : "#f4f2ef",
                  color: active ? "#ffffff" : "#78716c",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        {/* Static rail + animated dashed flow overlay. */}
        <div
          className="absolute w-0.5"
          style={{ left: 6, top: 8, bottom: 8, background: "#e7e5e0" }}
        />
        <div
          className="absolute w-0.5"
          style={{
            left: 6,
            top: 8,
            bottom: 8,
            background: "repeating-linear-gradient(#a8a29e 0 5px, transparent 5px 12px)",
            backgroundSize: "2px 320px",
            opacity: 0.5,
            animation: "flowSlow 18s linear infinite",
          }}
        />

        {visible.length === 0 ? (
          <p className="py-3 pl-8 text-[12.5px] text-[var(--v2-ink-3)]">
            Nothing here for this filter yet.
          </p>
        ) : (
          visible.map((item) => {
            const chip = KIND_CHIP[item.kind];
            return (
              <div key={item.key} className="relative flex gap-4 py-2.5">
                <span
                  className="z-[1] mt-0.5 size-3.5 flex-none rounded-full bg-white"
                  style={{ border: `2px solid ${item.actorColor}` }}
                />
                <div className="text-[13.5px] leading-[1.55] text-[var(--v2-ink-1)]">
                  <b
                    className="font-semibold"
                    style={{ color: item.actorColor }}
                  >
                    {item.actor}
                  </b>{" "}
                  {item.verb}{" "}
                  <Link
                    href={item.href}
                    className="rounded-[6px] px-[7px] py-px whitespace-nowrap transition-opacity hover:opacity-80"
                    style={{ backgroundColor: chip.bg, color: chip.fg }}
                  >
                    {item.object}
                  </Link>{" "}
                  <span className="text-[var(--v2-ink-4)]">→</span>{" "}
                  <span
                    className="rounded-[6px] px-[7px] py-px whitespace-nowrap"
                    style={{
                      backgroundColor: CONTEXT_CHIP.bg,
                      color: CONTEXT_CHIP.fg,
                    }}
                  >
                    {item.context}
                  </span>
                  <div className="font-mono mt-0.5 text-[11px] text-[var(--v2-ink-3)]">
                    {item.timeLabel}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoading}
          className="font-mono mt-2 cursor-pointer pl-8 text-[11px] tracking-[0.08em] text-[var(--v2-ink-3)] uppercase transition-colors hover:text-[var(--v2-ink-1)] disabled:opacity-50"
        >
          {isLoading ? "Loading…" : "Load more ↓"}
        </button>
      )}
    </>
  );
}
