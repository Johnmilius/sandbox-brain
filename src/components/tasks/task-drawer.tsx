"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  claimTask,
  releaseTask,
  toggleChecklistItem,
  updateTaskStatus,
} from "@/app/tasks/actions";
import {
  AREA_META,
  PRIORITY_META,
  STATUS_COLUMNS,
  type TaskVM,
} from "@/components/tasks/types";
import type { TaskStatus } from "@/lib/database.types";

type Viewer = { id: string; name: string };

type TaskDrawerProps = {
  task: TaskVM;
  currentUserId: string;
  currentUserName: string;
  /** Demo tickets are read-only — mutations would hit fake ids. */
  demo: boolean;
  onClose: () => void;
};

export function TaskDrawer({
  task,
  currentUserId,
  currentUserName,
  demo,
  onClose,
}: TaskDrawerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const unclaimed = task.claimedBy == null;
  const mine = task.claimedBy?.id === currentUserId;
  const lockedByOther = task.claimedBy != null && !mine;
  const conflict = task.conflictsWith[0];
  const priority = PRIORITY_META[task.priority];
  const area = AREA_META[task.area];
  const readOnly = demo || lockedByOther;

  // Per-ticket presence: who else has this drawer open right now.
  useEffect(() => {
    if (demo) return;
    const supabase = createClient();
    try {
      const channel = supabase.channel(`task-${task.id}`, {
        config: { presence: { key: currentUserId } },
      });
      channelRef.current = channel;
      channel.on("presence", { event: "sync" }, () => {
        try {
          const state = channel.presenceState<Viewer>();
          const others: Viewer[] = [];
          for (const key of Object.keys(state)) {
            const entry = state[key]?.[0] as unknown as Viewer | undefined;
            if (entry && entry.id !== currentUserId) others.push(entry);
          }
          setViewers(others);
        } catch {
          setViewers([]);
        }
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel
            .track({ id: currentUserId, name: currentUserName })
            .catch(() => {});
        }
      });
    } catch {
      // Realtime unavailable — no viewer indicator, nothing else breaks.
    }
    return () => {
      const channel = channelRef.current;
      if (channel) {
        try {
          channel.untrack();
          createClient().removeChannel(channel);
        } catch {
          // best-effort cleanup
        }
      }
    };
  }, [task.id, currentUserId, currentUserName, demo]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function run(action: () => Promise<{ error: string | null }>) {
    if (demo) {
      toast.info("Demo mode — actions are disabled.");
      return;
    }
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
      else router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close ticket"
        onClick={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(28,28,31,.28)" }}
      />
      <aside
        className="absolute top-0 right-0 flex h-full w-[396px] max-w-full flex-col overflow-y-auto bg-white"
        style={{
          boxShadow: "-12px 0 40px -18px rgba(0,0,0,.4)",
          animation: "v2-slideover .28s cubic-bezier(.32,.72,.28,1)",
        }}
      >
        <style>{`@keyframes v2-slideover { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10.5px] text-[var(--v2-ink-3)]">
              {task.ticketId} · {task.projectName}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-7 items-center justify-center rounded-[7px] text-[var(--v2-ink-3)] transition-colors hover:bg-[#efece7] hover:text-[var(--v2-ink-1)]"
            >
              <X className="size-4" />
            </button>
          </div>

          <h2
            className="font-display text-[23px] leading-tight text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            {task.title}
          </h2>

          {viewers.length > 0 && (
            <p className="text-[11px] text-[var(--v2-ink-3)]">
              👁 {viewers[0].name} is viewing this now
            </p>
          )}

          {conflict && (
            <div
              className="rounded-[9px] px-3 py-2.5 text-[11px] leading-snug"
              style={{
                backgroundColor: "var(--v2-warning-bg)",
                border: "1px solid var(--v2-warning-border)",
                color: "var(--v2-warning-text-deep)",
              }}
            >
              <span style={{ color: "var(--v2-warning-text)" }}>⚠</span> Heads
              up — {conflict.name} is also working in {task.area}. Coordinate to
              avoid a merge conflict.
            </div>
          )}

          {unclaimed && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => claimTask(task.id))}
              className="w-full rounded-[9px] bg-[#1c1c1f] py-2.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              🔓 Claim this ticket
            </button>
          )}
          {mine && (
            <div
              className="flex items-center justify-between rounded-[9px] px-3 py-2.5 text-[12.5px] font-medium"
              style={{
                backgroundColor: "var(--v2-success-bg)",
                border: "1px solid var(--v2-success-border)",
                color: "var(--v2-success-text)",
              }}
            >
              ✓ Claimed by you
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => releaseTask(task.id))}
                className="underline underline-offset-2 disabled:opacity-50"
              >
                Release
              </button>
            </div>
          )}
          {lockedByOther && task.claimedBy && (
            <div
              className="rounded-[9px] px-3 py-2.5 text-[12.5px] font-medium"
              style={{
                backgroundColor: "var(--v2-locked-bg)",
                border: "1px solid var(--v2-locked-border)",
                color: "var(--v2-locked-text)",
              }}
            >
              🔒 Locked by {task.claimedBy.label} — can&apos;t edit until
              released
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--v2-ink-2)]">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: priority.color }}
              />
              {priority.label}
            </span>
            <span
              className="rounded-[5px] px-[7px] py-0.5 text-[10px]"
              style={{ color: area.fg, backgroundColor: area.bg }}
            >
              {area.label}
            </span>
            {task.assignee ? (
              <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--v2-ink-2)]">
                <span
                  className="flex size-5 items-center justify-center rounded-full text-[9px] font-medium"
                  style={{ backgroundColor: "#e7e5e0", color: "#57534e" }}
                >
                  {task.assignee.initials}
                </span>
                {task.assignee.label}
              </span>
            ) : (
              <span className="text-[11.5px] text-[var(--v2-ink-4)]">
                Unassigned
              </span>
            )}
          </div>

          <div>
            <p className="font-mono-label mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_COLUMNS.map((col) => {
                const active = task.status === col.value;
                return (
                  <button
                    key={col.value}
                    type="button"
                    disabled={readOnly || pending}
                    onClick={() =>
                      run(() =>
                        updateTaskStatus(task.id, col.value as TaskStatus),
                      )
                    }
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed"
                    style={
                      active
                        ? { backgroundColor: "#1c1c1f", color: "#ffffff" }
                        : {
                            backgroundColor: "#f4f2ef",
                            color: "var(--v2-ink-2)",
                            opacity: readOnly ? 0.6 : 1,
                          }
                    }
                  >
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>

          {task.description && (
            <div>
              <p className="font-mono-label mb-1.5">Description</p>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--v2-ink-2)]">
                {task.description}
              </p>
            </div>
          )}

          <div>
            <p className="font-mono-label mb-2">Checklist</p>
            {task.checklist.length === 0 ? (
              <p className="text-[12px] text-[var(--v2-ink-4)]">
                No checklist items yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {task.checklist.map((item, index) => (
                  <button
                    key={`${index}-${item.text}`}
                    type="button"
                    disabled={readOnly || pending}
                    onClick={() =>
                      run(() => toggleChecklistItem(task.id, index))
                    }
                    className="flex items-center gap-2 text-left text-[12.5px] disabled:cursor-not-allowed"
                  >
                    <span
                      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] text-[10px]"
                      style={
                        item.done
                          ? { backgroundColor: "#1c1c1f", color: "#fff" }
                          : { border: "1.5px solid #d6d3cd" }
                      }
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span
                      className={
                        item.done
                          ? "text-[var(--v2-ink-3)] line-through"
                          : "text-[var(--v2-ink-1)]"
                      }
                    >
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="font-mono-label mb-2">◍ Linked in the brain</p>
            {task.links.length === 0 ? (
              <p className="text-[12px] text-[var(--v2-ink-4)]">
                Not linked to anything yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {task.links.map((link) => (
                  <Link
                    key={`${link.kind}:${link.href}:${link.label}`}
                    href={link.href}
                    className="flex items-center justify-between gap-2 rounded-[10px] bg-[var(--v2-rail-bg)] px-3 py-2 transition-colors hover:bg-[#f6f4f1]"
                    style={{ border: "1px solid #ededeb" }}
                  >
                    <span className="truncate text-[12px] font-medium text-[var(--v2-ink-1)]">
                      {link.label}
                    </span>
                    <span className="font-mono shrink-0 text-[9.5px] tracking-[0.1em] text-[var(--v2-ink-3)] uppercase">
                      {link.kind} →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
