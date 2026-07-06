"use client";

import { useState, useTransition, type ReactElement } from "react";
import { Star } from "lucide-react";
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
import { TagInput } from "@/components/tag-input";
import { createAgent, updateAgent } from "@/app/agents/actions";
import type { Agent, AgentStatus, Project } from "@/lib/database.types";

const NONE = "__none__";

const MODEL_SUGGESTIONS = [
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-haiku-4-5",
  "gpt-5",
  "gemini-2.5-pro",
];

type PromptOption = { id: string; title: string; is_favorite: boolean };

type AgentFormDialogProps = {
  agent?: Agent; // present = edit mode
  initialTags?: string[];
  initialPromptIds?: string[];
  projects: Project[];
  prompts: PromptOption[];
  tagSuggestions: string[];
  trigger: ReactElement<Record<string, unknown>>;
};

export function AgentFormDialog({
  agent,
  initialTags = [],
  initialPromptIds = [],
  projects,
  prompts,
  tagSuggestions,
  trigger,
}: AgentFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [tools, setTools] = useState<string[]>(agent?.tools ?? []);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [status, setStatus] = useState<AgentStatus>(agent?.status ?? "active");
  const [projectId, setProjectId] = useState<string>(agent?.project_id ?? NONE);
  const [promptIds, setPromptIds] = useState<string[]>(initialPromptIds);
  const [pending, startTransition] = useTransition();

  // Favorites first, then the rest — the vetted prompts are the ones to attach.
  const sortedPrompts = [...prompts].sort(
    (a, b) => Number(b.is_favorite) - Number(a.is_favorite),
  );

  function togglePrompt(id: string) {
    setPromptIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Name is required.");
      return;
    }
    const input = {
      name,
      description: String(form.get("description") ?? ""),
      systemPrompt: String(form.get("system_prompt") ?? ""),
      model: String(form.get("model") ?? ""),
      tools,
      status,
      projectId: projectId === NONE ? null : projectId,
    };

    startTransition(async () => {
      const { error } = agent
        ? await updateAgent(agent.id, input, tags, promptIds)
        : await createAgent(input, tags, promptIds);
      if (error) {
        toast.error(error);
      } else {
        toast.success(agent ? "Agent updated." : "Agent saved.");
        setOpen(false);
        if (!agent) {
          setTools([]);
          setTags([]);
          setPromptIds([]);
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit agent" : "Save an agent"}</DialogTitle>
          <DialogDescription>
            Capture a reusable AI agent — its system prompt, model, and the
            prompts it relies on.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={agent?.name}
              placeholder="e.g. Release-notes writer"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={agent?.description ?? ""}
              rows={2}
              placeholder="What is this agent for and when do we use it?"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="system_prompt">System prompt</Label>
            <Textarea
              id="system_prompt"
              name="system_prompt"
              defaultValue={agent?.system_prompt ?? ""}
              rows={6}
              className="font-mono text-xs"
              placeholder="The agent's instructions / persona…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                name="model"
                defaultValue={agent?.model ?? ""}
                placeholder="claude-opus-4-8…"
                list="agent-model-suggestions"
              />
              <datalist id="agent-model-suggestions">
                {MODEL_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AgentStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string | null) => (v === "archived" ? "Archived" : "Active")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tools / capabilities</Label>
            <TagInput
              value={tools}
              onChange={setTools}
              placeholder="Add a tool…"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v && v !== NONE
                      ? (projects.find((p) => p.id === v)?.name ?? "Project")
                      : "No project"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {sortedPrompts.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Prompts this agent uses</Label>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                {sortedPrompts.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={promptIds.includes(p.id)}
                      onChange={() => togglePrompt(p.id)}
                    />
                    {p.is_favorite && (
                      <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                    <span className="truncate">{p.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : agent ? "Save changes" : "Save agent"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
