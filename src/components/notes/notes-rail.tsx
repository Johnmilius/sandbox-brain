"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewNoteDialog } from "@/components/notes/new-note-dialog";
import { cn } from "@/lib/utils";

/**
 * Persistent note-list rail (design left pane, 270px on `#fdfcfb`): flat
 * rows with title + edited stamp + 2-line snippet + colored #tag.
 */

export type NoteRailItem = {
  id: string;
  title: string;
  snippet: string;
  editedLabel: string;
  tag: string | null;
  tagColor: string;
};

export function NotesRail({ notes }: { notes: NoteRailItem[] }) {
  const pathname = usePathname();

  return (
    <div
      className="w-[270px] shrink-0 overflow-y-auto border-r"
      style={{
        borderColor: "#f0eeeb",
        backgroundColor: "var(--v2-rail-bg)",
        padding: "20px 14px",
      }}
    >
      <div className="flex items-center justify-between px-1.5 pb-3">
        <span className="font-mono-label">All notes · {notes.length}</span>
        <NewNoteDialog
          trigger={
            <button
              type="button"
              aria-label="New note"
              className="cursor-pointer text-[15px] text-[var(--v2-ink-3)] transition-colors hover:text-[var(--v2-ink-1)]"
            >
              +
            </button>
          }
        />
      </div>
      <div className="flex flex-col gap-0.5">
        {notes.length === 0 && (
          <p className="px-1.5 text-[12px] leading-normal text-[var(--v2-ink-4)]">
            No notes yet — hit + to start the team wiki.
          </p>
        )}
        {notes.map((note) => {
          const active = pathname === `/notes/${note.id}`;
          return (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className={cn(
                "block rounded-[9px] transition-colors",
                active ? "bg-[#efece7]" : "hover:bg-[#faf9f7]",
              )}
              style={{ padding: "10px 11px" }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-[13px] text-[var(--v2-ink-1)]",
                    active ? "font-semibold" : "font-normal",
                  )}
                >
                  {note.title}
                </span>
                <span className="font-mono shrink-0 text-[10px] text-[var(--v2-ink-label)]">
                  {note.editedLabel}
                </span>
              </div>
              <p className="mt-[3px] line-clamp-2 text-[11.5px] leading-[1.4] text-[var(--v2-ink-3)]">
                {note.snippet || "Empty note"}
              </p>
              {note.tag && (
                <p
                  className="font-mono mt-[5px] text-[10px]"
                  style={{ color: note.tagColor }}
                >
                  #{note.tag}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
