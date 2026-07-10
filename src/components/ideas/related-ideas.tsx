"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { linkIdeas, unlinkIdeas } from "@/app/ideas/actions";

/**
 * "◍ RELATED IDEAS" rail block — design's type-ahead search box with a
 * dropdown of matches, linked ideas as removable rows (✕ to unlink).
 */

type IdeaOption = { id: string; title: string };

export function RelatedIdeas({
  ideaId,
  linked,
  options,
}: {
  ideaId: string;
  linked: IdeaOption[];
  options: IdeaOption[];
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const linkedIds = new Set(linked.map((l) => l.id));
  const q = query.trim().toLowerCase();
  const results = q
    ? options
        .filter(
          (o) => !linkedIds.has(o.id) && o.title.toLowerCase().includes(q),
        )
        .slice(0, 5)
    : [];

  function onLink(otherId: string) {
    startTransition(async () => {
      const { error } = await linkIdeas(ideaId, otherId);
      if (error) {
        toast.error(error);
      } else {
        setQuery("");
        router.refresh();
      }
    });
  }

  function onUnlink(otherId: string) {
    startTransition(async () => {
      const { error } = await unlinkIdeas(ideaId, otherId);
      if (error) toast.error(error);
      else router.refresh();
    });
  }

  return (
    <div>
      <p className="font-mono mb-1 text-[10px] tracking-[0.13em] text-[var(--v2-ink-3)] uppercase">
        ◍ Related ideas
      </p>
      <p className="mb-3 text-[11px] text-[var(--v2-ink-3)]">
        Linked by hand · bidirectional
      </p>

      <div className="relative mb-3">
        <div
          className="flex h-8 items-center gap-[7px] rounded-[8px] bg-white px-2.5"
          style={{ border: "1px solid #e8e4dc" }}
        >
          <span className="text-[12px] text-[var(--v2-ink-label)]">+</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ideas to link…"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#57534e] outline-none placeholder:text-[var(--v2-ink-3)]"
          />
        </div>
        {q && (
          <div
            className="absolute top-9 right-0 left-0 z-[5] overflow-hidden rounded-[9px] bg-white"
            style={{
              border: "1px solid #e8e4dc",
              boxShadow: "0 8px 22px -10px rgba(0,0,0,.25)",
            }}
          >
            {results.length === 0 ? (
              <div className="px-3 py-2.5 text-[12px] text-[var(--v2-ink-4)]">
                No matches
              </div>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={pending}
                  onClick={() => onLink(r.id)}
                  className="flex w-full cursor-pointer items-center gap-2 border-b px-3 py-[9px] text-left transition-colors hover:bg-[#faf8ff]"
                  style={{ borderColor: "#f4f2ef" }}
                >
                  <span className="size-1.5 rounded-full bg-[#cfcac2]" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--v2-ink-1)]">
                    {r.title}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--v2-accent-purple)" }}
                  >
                    link
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[7px]">
        {linked.length === 0 ? (
          <p className="text-[12px] leading-normal text-[var(--v2-ink-4)]">
            No linked ideas yet. Search above to connect one.
          </p>
        ) : (
          linked.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-2 rounded-[10px] bg-white px-[11px] py-[9px]"
              style={{ border: "1px solid #ededeb" }}
            >
              <span className="size-[7px] flex-none rounded-full bg-[#cfcac2]" />
              <Link
                href={`/ideas/${l.id}`}
                className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--v2-ink-1)] hover:underline"
              >
                {l.title}
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => onUnlink(l.id)}
                aria-label="Unlink idea"
                className="flex-none cursor-pointer text-[13px] text-[var(--v2-ink-4)] transition-colors hover:text-[var(--v2-danger)]"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
