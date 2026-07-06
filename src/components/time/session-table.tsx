"use client";

import { useState } from "react";
import Link from "next/link";
import { Boxes, ChevronRight, FileText, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      <TableRow>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1">
            {hasActivity ? (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={
                  open ? "Hide session activity" : "Show session activity"
                }
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
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
        <TableCell>{entry.whoName}</TableCell>
        <TableCell className="text-muted-foreground">{entry.when}</TableCell>
        <TableCell className="text-right tabular-nums">
          {entry.durationLabel}
        </TableCell>
        <TableCell className="max-w-56">
          <div className="flex items-center gap-2">
            <span className="truncate text-muted-foreground">
              {entry.notes ?? ""}
            </span>
            {entry.source === "manual" && <Badge variant="outline">manual</Badge>}
            {hasActivity && (
              <Badge variant="secondary" className="shrink-0">
                {entry.activity.length} item{entry.activity.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="w-10">
          <DeleteEntryButton entryId={entry.id} />
        </TableCell>
      </TableRow>

      {open && hasActivity && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="py-2">
            <div className="flex flex-col gap-1.5 pl-6">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Done during this session
              </p>
              {entry.activity.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <Link
                    key={`${item.kind}:${item.id}`}
                    href={item.href}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
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
