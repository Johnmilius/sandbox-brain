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
import { TagInput } from "@/components/tag-input";
import { createPrompt, updatePrompt } from "@/app/prompts/actions";
import type { Project, Prompt } from "@/lib/database.types";

const TOOL_SUGGESTIONS = [
  "claude",
  "claude-code",
  "chatgpt",
  "cursor",
  "gemini",
  "copilot",
];

const NONE = "__none__";

type PromptFormDialogProps = {
  prompt?: Prompt; // present = edit mode
  initialTags?: string[];
  projects: Project[];
  tagSuggestions: string[];
  trigger: ReactElement<Record<string, unknown>>;
};

export function PromptFormDialog({
  prompt,
  initialTags = [],
  projects,
  tagSuggestions,
  trigger,
}: PromptFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [projectId, setProjectId] = useState<string>(prompt?.project_id ?? NONE);
  const [rating, setRating] = useState<string>(
    prompt?.rating != null ? String(prompt.rating) : NONE,
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const promptText = String(form.get("prompt_text") ?? "");
    if (!title || !promptText.trim()) {
      toast.error("Title and prompt text are required.");
      return;
    }
    const input = {
      title,
      promptText,
      responseNotes: String(form.get("response_notes") ?? ""),
      aiTool: String(form.get("ai_tool") ?? ""),
      rating: rating === NONE ? null : Number(rating),
      projectId: projectId === NONE ? null : projectId,
    };

    startTransition(async () => {
      const { error } = prompt
        ? await updatePrompt(prompt.id, input, tags)
        : await createPrompt(input, tags);
      if (error) {
        toast.error(error);
      } else {
        toast.success(prompt ? "Prompt updated." : "Prompt saved.");
        setOpen(false);
        if (!prompt) setTags([]);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{prompt ? "Edit prompt" : "Save a prompt"}</DialogTitle>
          <DialogDescription>
            Log a prompt so the team can search it and learn what works.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={prompt?.title}
              placeholder="e.g. Landing page hero copy v2"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prompt_text">Prompt</Label>
            <Textarea
              id="prompt_text"
              name="prompt_text"
              defaultValue={prompt?.prompt_text}
              placeholder="Paste the full prompt you sent…"
              rows={6}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="response_notes">Result / notes</Label>
            <Textarea
              id="response_notes"
              name="response_notes"
              defaultValue={prompt?.response_notes ?? ""}
              placeholder="How did it go? What would you change?"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai_tool">AI tool</Label>
              <Input
                id="ai_tool"
                name="ai_tool"
                defaultValue={prompt?.ai_tool ?? ""}
                placeholder="claude, chatgpt…"
                list="ai-tool-suggestions"
              />
              <datalist id="ai-tool-suggestions">
                {TOOL_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Rating</Label>
              <Select value={rating} onValueChange={(v) => setRating(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unrated</SelectItem>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {"★".repeat(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
                <SelectItem value={NONE}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tags</Label>
            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : prompt ? "Save changes" : "Save prompt"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
