"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { promoteIdeaToProject } from "@/app/ideas/actions";

/**
 * Promote banner — design's two states: green "Promoted to a Project"
 * record, or the purple "Ready to build this for real?" call-to-action with
 * an inline two-step confirm (Promote to Project → Create Project / Cancel).
 */

export function PromoteBanner({
  ideaId,
  promoted,
  promotedName,
}: {
  ideaId: string;
  promoted: boolean;
  promotedName: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmPromote() {
    startTransition(async () => {
      const { error } = await promoteIdeaToProject(ideaId);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Promoted to a project.");
        setConfirming(false);
        router.refresh();
      }
    });
  }

  if (promoted) {
    return (
      <div
        className="mb-6 flex items-center gap-3 rounded-[12px]"
        style={{
          backgroundColor: "var(--v2-success-bg)",
          border: "1px solid var(--v2-success-border)",
          padding: "13px 16px",
        }}
      >
        <span
          className="flex size-[34px] flex-none items-center justify-center rounded-[9px] text-[16px]"
          style={{ backgroundColor: "#dcefe3", color: "#3f7a56" }}
        >
          ▦
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold" style={{ color: "#2f6446" }}>
            Promoted to a Project
          </div>
          <div className="text-[12px]" style={{ color: "#5f8a72" }}>
            This idea became <b>{promotedName ?? "a project"}</b> — kept here
            as its origin record.
          </div>
        </div>
        <Link
          href="/projects"
          className="flex-none text-[12.5px] font-medium hover:underline"
          style={{ color: "#3f7a56" }}
        >
          View project →
        </Link>
      </div>
    );
  }

  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-[12px]"
      style={{
        backgroundColor: "#faf8ff",
        border: "1px solid #e6ddf5",
        padding: "13px 16px",
      }}
    >
      <span
        className="flex size-[34px] flex-none items-center justify-center rounded-[9px] text-[16px]"
        style={{ backgroundColor: "#f2ecfd", color: "var(--v2-accent-purple)" }}
      >
        ↗
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-[var(--v2-ink-1)]">
          Ready to build this for real?
        </div>
        <div className="text-[12px] leading-[1.45] text-[var(--v2-ink-2)]">
          Creates the Project and keeps this idea as its origin.
        </div>
      </div>
      {confirming ? (
        <div className="flex flex-none items-center gap-[7px] whitespace-nowrap">
          <button
            type="button"
            disabled={pending}
            onClick={confirmPromote}
            className="cursor-pointer rounded-[8px] px-[13px] py-2 text-[12px] font-medium text-white"
            style={{ backgroundColor: "#3f7a56" }}
          >
            {pending ? "Creating…" : "Create Project"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="cursor-pointer rounded-[8px] px-[11px] py-2 text-[12px] text-[var(--v2-ink-2)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex-none cursor-pointer rounded-[9px] bg-[#1c1c1f] px-4 py-[9px] text-[12.5px] font-medium whitespace-nowrap text-white transition-opacity hover:opacity-85"
        >
          Promote to Project
        </button>
      )}
    </div>
  );
}
