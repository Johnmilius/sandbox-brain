"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "@/components/markdown-view";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteNote, updateNote } from "@/app/notes/actions";
import type { Note } from "@/lib/database.types";

type NoteEditorProps = {
  note: Note;
  /** Body with [[wiki-links]] already rewritten to /notes/<id> markdown links. */
  renderedBody: string;
  startInEdit: boolean;
};

export function NoteEditor({ note, renderedBody, startInEdit }: NoteEditorProps) {
  const [editing, setEditing] = useState(startInEdit);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSave() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      const { error } = await updateNote(note.id, { title, body });
      if (error) {
        toast.error(error);
      } else {
        toast.success("Note saved.");
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1
            className="font-display text-[30px] leading-tight text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            {note.title}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="rounded-full border-[#e2ddd6] bg-white text-[var(--v2-ink-1)] hover:bg-[#f6f4f1]"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <DeleteConfirmButton
              itemName={`note "${note.title}"`}
              ariaLabel="Delete note"
              successMessage="Note deleted."
              onDelete={() => deleteNote(note.id)}
              onDeleted={() => router.push("/notes")}
            />
          </div>
        </div>
        {note.body.trim() === "" ? (
          <p className="text-[13px] text-[var(--v2-ink-3)]">
            Empty note — hit Edit to start writing. Use [[Another Note]] to link.
          </p>
        ) : (
          <div className="text-[15px] leading-[1.85] text-[var(--v2-ink-1)]">
            <MarkdownView markdown={renderedBody} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="font-display border-none px-0 !text-[26px] leading-tight shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            onClick={onSave}
            disabled={pending}
            className="rounded-full bg-[#1c1c1f] text-white hover:bg-[#1c1c1f]/85"
          >
            <Save className="size-3.5" />
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTitle(note.title);
              setBody(note.body);
              setEditing(false);
            }}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
        </div>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={20}
        placeholder={"Write markdown…\n\nLink to other notes with [[Note Title]]."}
        className="min-h-[50vh] font-mono text-sm"
      />
    </div>
  );
}
