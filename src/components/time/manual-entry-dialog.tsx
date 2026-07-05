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
import { formatDuration } from "@/lib/format";
import type { Project } from "@/lib/database.types";

function todayISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Mode = "duration" | "range";

type ManualEntryDialogProps = {
  projects: Project[];
  trigger: ReactElement<Record<string, unknown>>;
};

export function ManualEntryDialog({ projects, trigger }: ManualEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );
  const [mode, setMode] = useState<Mode>("duration");
  const [startDate, setStartDate] = useState(todayISODate());
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(todayISODate());
  const [endTime, setEndTime] = useState("10:00");
  const [pending, startTransition] = useTransition();

  // Live preview of the computed duration in range mode.
  const rangeMs =
    new Date(`${endDate}T${endTime}`).getTime() -
    new Date(`${startDate}T${startTime}`).getTime();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) {
      toast.error("Create a project first.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const notes = String(form.get("notes") ?? "");

    // Computed client-side so the entry lands in the user's local timezone.
    const startedAt = new Date(`${startDate}T${startTime}`);
    let endedAt: Date;

    if (mode === "range") {
      endedAt = new Date(`${endDate}T${endTime}`);
      if (endedAt.getTime() <= startedAt.getTime()) {
        toast.error("End time must be after the start time.");
        return;
      }
    } else {
      const hours = Number(form.get("hours") || 0);
      const minutes = Number(form.get("minutes") || 0);
      const durationMs = (hours * 60 + minutes) * 60_000;
      if (durationMs <= 0) {
        toast.error("Duration must be greater than zero.");
        return;
      }
      endedAt = new Date(startedAt.getTime() + durationMs);
    }

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
                <SelectValue>
                  {(value: string | null) =>
                    projects.find((p) => p.id === value)?.name ??
                    "Select a project"
                  }
                </SelectValue>
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

          {/* Entry mode toggle */}
          <div className="flex flex-col gap-2">
            <Label>How do you want to enter it?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "duration" ? "secondary" : "outline"}
                onClick={() => setMode("duration")}
              >
                By duration
              </Button>
              <Button
                type="button"
                variant={mode === "range" ? "secondary" : "outline"}
                onClick={() => setMode("range")}
              >
                Start &amp; end
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">
                {mode === "range" ? "Start date" : "Date"}
              </Label>
              <Input
                id="date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_time">Start time</Label>
              <Input
                id="start_time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          {mode === "duration" ? (
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
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="end_date">End date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="end_time">End time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Duration:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {rangeMs > 0 ? formatDuration(rangeMs) : "—"}
                </span>
              </p>
            </>
          )}

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
