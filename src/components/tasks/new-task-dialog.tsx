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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask } from "@/app/tasks/actions";
import type { PersonOption, ProjectOption } from "@/components/tasks/types";
import type { TaskArea, TaskPriority } from "@/lib/database.types";

const NONE = "__none__";
const PRIORITIES: TaskPriority[] = ["high", "med", "low"];
const AREAS: TaskArea[] = ["frontend", "backend", "design", "copy"];

type NewTaskDialogProps = {
  projects: ProjectOption[];
  people: PersonOption[];
  trigger: ReactElement;
};

export function NewTaskDialog({ projects, people, trigger }: NewTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState<TaskPriority>("med");
  const [area, setArea] = useState<TaskArea>("frontend");
  const [assignee, setAssignee] = useState<string>(NONE);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!projectId) {
      toast.error("Pick a project.");
      return;
    }
    startTransition(async () => {
      const { error } = await createTask({
        project_id: projectId,
        title,
        description,
        priority,
        area,
        assignee: assignee === NONE ? null : assignee,
      });
      if (error) {
        toast.error(error);
      } else {
        toast.success("Ticket created.");
        setTitle("");
        setDescription("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>
            Claim it after creating to lock it to you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Context, links, acceptance criteria…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
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
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Area</Label>
              <Select value={area} onValueChange={(v) => setArea(v as TaskArea)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a} className="capitalize">
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Assignee</Label>
            <Select value={assignee} onValueChange={(v) => setAssignee(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v && v !== NONE
                      ? (people.find((p) => p.id === v)?.label ?? "Assignee")
                      : "Unassigned"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={onSubmit}
            disabled={pending}
            className="rounded-full bg-[#1c1c1f] text-white hover:bg-[#1c1c1f]/85"
          >
            {pending ? "Creating…" : "Create ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
