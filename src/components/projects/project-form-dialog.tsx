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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject, updateProject } from "@/app/projects/actions";
import type { Project, ProjectStatus } from "@/lib/database.types";

const STATUSES: ProjectStatus[] = ["active", "paused", "completed", "archived"];

type ProjectFormDialogProps = {
  project?: Project; // present = edit mode
  trigger: ReactElement<Record<string, unknown>>;
};

export function ProjectFormDialog({ project, trigger }: ProjectFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Project name is required.");
      return;
    }
    const input = {
      name,
      description: String(form.get("description") ?? ""),
      status,
    };

    startTransition(async () => {
      const { error } = project
        ? await updateProject(project.id, input)
        : await createProject(input);
      if (error) {
        toast.error(error);
      } else {
        toast.success(project ? "Project updated." : "Project created.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            A company or project the team spends time on.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={project?.name}
              placeholder="e.g. Acme Landing Page"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={project?.description ?? ""}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProjectStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : project ? "Save changes" : "Create project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
