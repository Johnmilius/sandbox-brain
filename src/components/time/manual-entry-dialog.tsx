"use client";

import { useState, useTransition, type ReactElement } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addManualEntry } from "@/app/time/actions";
import type { Project } from "@/lib/database.types";

function todayISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type ManualEntryDialogProps = {
  projects: Project[];
  trigger: ReactElement<Record<string, unknown>>;
};

export function ManualEntryDialog({ projects, trigger }: ManualEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) {
      toast.error("Create a project first.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const startTime = String(form.get("start_time") || "09:00");
    const hours = Number(form.get("hours") || 0);
    const minutes = Number(form.get("minutes") || 0);
    const notes = String(form.get("notes") ?? "");

    const durationMs = (hours * 60 + minutes) * 60_000;
    if (durationMs <= 0) {
      toast.error("Duration must be greater than zero.");
      return;
    }

    // Computed client-side so the entry lands in the user's local timezone.
    const startedAt = new Date(`${date}T${startTime}`);
    const endedAt = new Date(startedAt.getTime() + durationMs);

    startTransition(async () => {
      const { error } = await addManualEntry({
        projectId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        notes,
      });
      if (error) {
        toast.error(error);
      } else {
        toast.success("Time logged.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time manually</DialogTitle>
          <DialogDescription>
            Backfill a work session you forgot to time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Project</Label>
            <Select
              value={projectId}
              onValueChange={(v) => setProjectId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={todayISODate()} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">Start time</Label>
              <Input id="start_time" name="start_time" type="time" defaultValue="09:00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="hours">Hours</Label>
              <Input id="hours" name="hours" type="number" min={0} max={24} defaultValue={1} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="minutes">Minutes</Label>
              <Input id="minutes" name="minutes" type="number" min={0} max={59} defaultValue={0} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="What did you work on? (optional)" />
          </div>
          <Button type="submit" disabled={pending || !projectId}>
            {pending ? "Saving…" : "Log time"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
