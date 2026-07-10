"use client";

import {
  AREA_META,
  PRIORITY_META,
  STATUS_COLUMNS,
  type TaskVM,
} from "@/components/tasks/types";

type ListProps = {
  tasks: TaskVM[];
  onOpen: (task: TaskVM) => void;
};

const STATUS_LABEL = new Map(STATUS_COLUMNS.map((c) => [c.value, c.label]));

export function List({ tasks, onOpen }: ListProps) {
  return (
    <div
      className="max-w-[900px] overflow-x-auto rounded-[12px] bg-white"
      style={{ border: "1px solid #ededeb" }}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr style={{ backgroundColor: "#faf9f7" }}>
            {["ID", "Ticket", "Status", "Area", "Owner"].map((h) => (
              <th
                key={h}
                className="font-mono px-3 py-2 text-[10px] font-normal tracking-[0.1em] text-[var(--v2-ink-label)] uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-6 text-center text-[12px] text-[#c4c1ba]"
              >
                No tickets
              </td>
            </tr>
          )}
          {tasks.map((task) => {
            const priority = PRIORITY_META[task.priority];
            const area = AREA_META[task.area];
            const conflict = task.conflictsWith[0];
            return (
              <tr
                key={task.id}
                onClick={() => onOpen(task)}
                className="cursor-pointer transition-colors hover:bg-[#faf9f7]"
                style={{ borderTop: "1px solid #f4f2ef" }}
              >
                <td className="font-mono px-3 py-2.5 text-[10.5px] text-[var(--v2-ink-label)]">
                  {task.ticketId}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-[7px] shrink-0 rounded-full"
                      style={{ backgroundColor: priority.color }}
                      title={`${priority.label} priority`}
                    />
                    <span className="text-[13px] font-medium text-[var(--v2-ink-1)]">
                      {task.title}
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
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[10.5px] text-[var(--v2-ink-2)]">
                  {STATUS_LABEL.get(task.status)}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="rounded-[5px] px-[7px] py-0.5 text-[10px]"
                    style={{ color: area.fg, backgroundColor: area.bg }}
                  >
                    {area.label}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {task.assignee ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="flex size-[22px] items-center justify-center rounded-full text-[9px] font-semibold"
                        style={{ backgroundColor: "#e7e5e0", color: "#57534e" }}
                      >
                        {task.assignee.initials}
                      </span>
                      <span className="text-[11.5px] text-[var(--v2-ink-2)]">
                        {task.assignee.label.split(/\s+/)[0]}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--v2-ink-4)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
