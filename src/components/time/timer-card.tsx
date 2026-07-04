"use client";

import { useEffect, useState, useTransition } from "react";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startTimer, stopTimer } from "@/app/time/actions";
import { formatClock } from "@/lib/format";
import type { Project, TimeEntry } from "@/lib/database.types";

type TimerCardProps = {
  projects: Project[]; // active projects for the picker
  runningEntry: (TimeEntry & { projectName: string }) | null;
};

export function TimerCard({ projects, runningEntry }: TimerCardProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(
    projects[0]?.id ?? null,
  );
  const [notes, setNotes] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();

  const running = runningEntry != null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  function onStart() {
    if (!selectedProject) {
      toast.error("Create a project first, then start the timer.");
      return;
    }
    startTransition(async () => {
      const { error } = await startTimer(selectedProject);
      if (error) toast.error(error);
    });
  }

  function onStop() {
    if (!runningEntry) return;
    startTransition(async () => {
      const { error } = await stopTimer(runningEntry.id, notes);
      if (error) {
        toast.error(error);
      } else {
        setNotes("");
        toast.success("Time logged.");
      }
    });
  }

  const elapsed = runningEntry
    ? Math.max(0, now - new Date(runningEntry.started_at).getTime())
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {running ? `Working on ${runningEntry.projectName}` : "Start a timer"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {running ? (
          <>
            <div className="font-mono text-4xl font-semibold tabular-nums">
              {formatClock(elapsed)}
            </div>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on? (optional)"
            />
            <Button onClick={onStop} disabled={pending} variant="destructive">
              <Square className="size-4" />
              Stop &amp; log
            </Button>
          </>
        ) : (
          <>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active projects yet — create one on the Projects page.
              </p>
            ) : (
              <Select
                value={selectedProject}
                onValueChange={(v) => setSelectedProject(v as string)}
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
            )}
            <Button onClick={onStart} disabled={pending || !selectedProject}>
              <Play className="size-4" />
              Start timer
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
