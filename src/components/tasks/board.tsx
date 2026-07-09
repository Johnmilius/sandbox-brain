"use client";

import { TaskCard } from "@/components/tasks/task-card";
import { STATUS_COLUMNS, type TaskVM } from "@/components/tasks/types";

type BoardProps = {
  tasks: TaskVM[];
  onOpen: (task: TaskVM) => void;
};

export function Board({ tasks, onOpen }: BoardProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {STATUS_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.value);
        return (
          <div
            key={col.value}
            className="w-[236px] shrink-0 rounded-[12px] p-2.5"
            style={{
              backgroundColor: "#faf9f7",
              border: "1px solid #f0eeeb",
            }}
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--v2-ink-label)] uppercase">
                {col.label}
              </span>
              <span className="font-mono text-[10px] text-[var(--v2-ink-3)] tabular-nums">
                {colTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {colTasks.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11.5px] text-[#c4c1ba]">
                  No tickets
                </p>
              ) : (
                colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onOpen={onOpen} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
