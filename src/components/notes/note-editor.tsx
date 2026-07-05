"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "@/components/markdown-view";
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

  function onDelete() {
    if (!confirm(`Delete note "${note.title}"?`)) return;
    startTransition(async () => {
      const { error } = await deleteNote(note.id);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Note deleted.");
        router.push("/notes");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{note.title}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              disabled={pending}
              aria-label="Delete note"
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
        {note.body.trim() === "" ? (
          <p className="text-sm text-muted-foreground">
            Empty note — hit Edit to start writing. Use [[Another Note]] to link.
          </p>
        ) : (
          <MarkdownView markdown={renderedBody} />
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
          className="text-lg font-semibold"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={onSave} disabled={pending}>
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
