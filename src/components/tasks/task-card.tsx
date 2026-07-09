"use client";

import { AREA_META, PRIORITY_META, type TaskVM } from "@/components/tasks/types";

type TaskCardProps = {
  task: TaskVM;
  onOpen: (task: TaskVM) => void;
};

export function TaskCard({ task, onOpen }: TaskCardProps) {
  const priority = PRIORITY_META[task.priority];
  const area = AREA_META[task.area];
  const doneCount = task.checklist.filter((c) => c.done).length;
  const conflict = task.conflictsWith[0];

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="w-full rounded-[10px] bg-white text-left transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.16)]"
      style={{
        border: "1px solid #ededeb",
        padding: "11px 12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-[5px] size-2 shrink-0 rounded-full"
          style={{ backgroundColor: priority.color }}
          title={`${priority.label} priority`}
        />
        <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-[var(--v2-ink-1)]">
          {task.title}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="rounded-[6px] px-1.5 py-0.5 text-[10px] font-medium"
          style={{ color: area.fg, backgroundColor: area.bg }}
        >
          {task.area}
        </span>
        <span className="font-mono text-[10px] text-[var(--v2-ink-3)]">
          {task.ticketId}
        </span>
        {conflict && (
          <span
            className="text-[11px]"
            style={{ color: "#c2410c" }}
            title={`Same area as ${conflict.name} · ${conflict.ticketId}`}
          >
            ⚠
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {task.claimedBy && !task.assignee ? null : task.assignee ? (
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium"
              style={{ backgroundColor: "#e7e5e0", color: "#57534e" }}
              title={task.assignee.label}
            >
              {task.assignee.initials}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--v2-ink-4)]">—</span>
          )}
          {task.claimedBy && (
            <span
              className="truncate text-[10px]"
              style={{ color: "var(--v2-locked-text)" }}
              title={`Locked by ${task.claimedBy.label}`}
            >
              🔒 {task.claimedBy.label.split(/\s+/)[0]}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {task.checklist.length > 0 && (
            <span className="font-mono text-[10px] text-[var(--v2-ink-3)]">
              ☑ {doneCount}/{task.checklist.length}
            </span>
          )}
          {task.links.length > 0 && (
            <span
              className="font-mono text-[10px]"
              style={{ color: "var(--v2-accent-purple)" }}
            >
              ◍ {task.links.length}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
