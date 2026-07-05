"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createNote } from "@/app/notes/actions";

export function NewNoteDialog({
  trigger,
}: {
  trigger: ReactElement<Record<string, unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "");
    if (!title) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      const { id, error } = await createNote(title, body);
      if (error || !id) {
        toast.error(error ?? "Couldn't create the note.");
      } else {
        toast.success("Note created.");
        setOpen(false);
        router.push(`/notes/${id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>
            Reference other notes with [[double-bracket]] links — they become
            edges in the graph.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Customer interview takeaways"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="body">Note</Label>
            <Textarea
              id="body"
              name="body"
              rows={8}
              placeholder={"Write markdown…\n\nLink to other notes with [[Note Title]]."}
              className="font-mono text-sm"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save note"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
