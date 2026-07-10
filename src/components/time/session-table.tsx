"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, ChevronRight, FileText, MessageSquareText } from "lucide-react";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DeleteEntryButton } from "@/components/time/delete-entry-button";
import { cn } from "@/lib/utils";

export type SessionActivityItem = {
  id: string;
  title: string;
  kind: "note" | "prompt" | "knowledge";
  href: string;
};

export type SessionEntry = {
  id: string;
  projectName: string;
  whoName: string;
  when: string;
  durationLabel: string;
  notes: string | null;
  source: string;
  activity: SessionActivityItem[];
};

const KIND_ICON = {
  note: FileText,
  prompt: MessageSquareText,
  knowledge: Boxes,
} as const;
const KIND_LABEL = { note: "Note", prompt: "Prompt", knowledge: "Brain" } as const;

export function SessionTable({ entries }: { entries: SessionEntry[] }) {
  return (
    <TableBody>
      {entries.map((entry) => (
        <EntryRows key={entry.id} entry={entry} />
      ))}
    </TableBody>
  );
}

function EntryRows({ entry }: { entry: SessionEntry }) {
  const [open, setOpen] = useState(false);
  const hasActivity = entry.activity.length > 0;

  return (
    <>
      <TableRow style={{ borderColor: "#f4f2ef" }}>
        <TableCell className="text-[13px] font-medium text-[var(--v2-ink-1)]">
          <div className="flex items-center gap-1">
            {hasActivity ? (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={
                  open ? "Hide session activity" : "Show session activity"
                }
                className="rounded p-0.5 text-[var(--v2-ink-3)] hover:text-[var(--v2-ink-1)]"
              >
                <ChevronRight
                  className={cn("size-3.5 transition-transform", open && "rotate-90")}
                />
              </button>
            ) : (
              <span className="inline-block w-[18px]" />
            )}
            {entry.projectName}
          </div>
        </TableCell>
        <TableCell className="text-[13px] text-[var(--v2-ink-1)]">
          {entry.whoName}
        </TableCell>
        <TableCell className="font-mono text-[11px] text-[var(--v2-ink-2)]">
          {entry.when}
        </TableCell>
        <TableCell className="font-mono text-right text-[12px] text-[var(--v2-ink-1)] tabular-nums">
          {entry.durationLabel}
        </TableCell>
        <TableCell className="max-w-56">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] text-[var(--v2-ink-2)]">
              {entry.notes ?? ""}
            </span>
            {entry.source === "manual" && (
              <span
                className="font-mono shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] text-[var(--v2-ink-3)]"
                style={{ borderColor: "#e2ddd6" }}
              >
                manual
              </span>
            )}
            {hasActivity && (
              <span
                className="font-mono shrink-0 rounded-full px-2 py-0.5 text-[10px] text-[var(--v2-ink-2)]"
                style={{ backgroundColor: "#f4f2ef" }}
              >
                {entry.activity.length} item{entry.activity.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="w-10">
          <DeleteEntryButton entryId={entry.id} />
        </TableCell>
      </TableRow>

      {open && hasActivity && (
        <TableRow
          className="hover:bg-transparent"
          style={{ borderColor: "#f4f2ef", backgroundColor: "#faf9f7" }}
        >
          <TableCell colSpan={6} className="py-2">
            <div className="flex flex-col gap-1.5 pl-6">
              <p className="font-mono-label">Done during this session</p>
              {entry.activity.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <Link
                    key={`${item.kind}:${item.id}`}
                    href={item.href}
                    className="flex items-center gap-2 text-[13px] text-[var(--v2-ink-1)] hover:underline"
                  >
                    <Icon className="size-3.5 shrink-0 text-[var(--v2-ink-3)]" />
                    <span className="truncate">{item.title}</span>
                    <span className="font-mono shrink-0 text-[10px] text-[var(--v2-ink-3)]">
                      {KIND_LABEL[item.kind]}
                    </span>
                  </Link>
                );
              })}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
