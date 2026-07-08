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
import { createIdea } from "@/app/ideas/actions";

export function NewIdeaDialog({
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
    const tagline = String(form.get("tagline") ?? "").trim();
    if (!title) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      const { id, error } = await createIdea({ title, tagline });
      if (error || !id) {
        toast.error(error ?? "Couldn't create the idea.");
      } else {
        toast.success("Idea created.");
        setOpen(false);
        router.push(`/ideas/${id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New idea</DialogTitle>
          <DialogDescription>
            Just a title to start — flesh out the problem, customer, and
            solution once you&apos;re on the idea page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. SyllabusIQ"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              name="tagline"
              placeholder="One sentence pitch"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create idea"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
