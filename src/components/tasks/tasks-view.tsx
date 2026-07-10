"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board } from "@/components/tasks/board";
import { List } from "@/components/tasks/list";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import type {
  PersonOption,
  ProjectOption,
  TaskVM,
} from "@/components/tasks/types";

type TasksViewProps = {
  tasks: TaskVM[];
  projects: ProjectOption[];
  people: PersonOption[];
  currentUserId: string;
  currentUserName: string;
  demo: boolean;
  /** Pre-select a project pill (deep link from Home rail / project cards). */
  initialProjectId?: string | null;
};

export function TasksView({
  tasks,
  projects,
  people,
  currentUserId,
  currentUserName,
  demo,
  initialProjectId = null,
}: TasksViewProps) {
  const [view, setView] = useState<"board" | "list">("board");
  const [projectFilter, setProjectFilter] = useState<string | null>(
    initialProjectId,
  );
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const visible = projectFilter
    ? tasks.filter((t) => t.projectId === projectFilter)
    : tasks;
  // Re-derive from props so server refreshes flow into the open drawer.
  const openTask = openTaskId
    ? (tasks.find((t) => t.id === openTaskId) ?? null)
    : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setProjectFilter(null)}
            className={cn(
              "rounded-full px-3 py-1 text-[11.5px] transition-colors",
              projectFilter === null
                ? "bg-[#1c1c1f] font-medium text-white"
                : "bg-[#f4f2ef] text-[var(--v2-ink-2)] hover:text-[var(--v2-ink-1)]",
            )}
          >
            All projects
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setProjectFilter(projectFilter === p.id ? null : p.id)
              }
              className={cn(
                "rounded-full px-3 py-1 text-[11.5px] transition-colors",
                projectFilter === p.id
                  ? "bg-[#1c1c1f] font-medium text-white"
                  : "bg-[#f4f2ef] text-[var(--v2-ink-2)] hover:text-[var(--v2-ink-1)]",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-[9px] p-0.5"
            style={{ backgroundColor: "#efece7" }}
            role="tablist"
            aria-label="Task views"
          >
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-[7px] px-3 py-1 text-[12px] capitalize transition-colors",
                  view === v
                    ? "bg-white font-medium text-[var(--v2-ink-1)] shadow-sm"
                    : "text-[var(--v2-ink-2)] hover:text-[var(--v2-ink-1)]",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          {!demo && (
            <NewTaskDialog
              projects={projects}
              people={people}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full bg-[#1c1c1f] px-4 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-85"
                >
                  <Plus className="size-3.5" />
                  New ticket
                </button>
              }
            />
          )}
        </div>
      </div>

      {view === "board" ? (
        <Board
          tasks={visible}
          onOpen={(t) => setOpenTaskId(t.id)}
          openTaskId={openTaskId}
        />
      ) : (
        <List tasks={visible} onOpen={(t) => setOpenTaskId(t.id)} />
      )}

      {openTask && (
        <TaskDrawer
          task={openTask}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          demo={demo}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}
