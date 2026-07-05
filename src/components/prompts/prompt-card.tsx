"use client";

import { useState } from "react";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PromptFormDialog } from "@/components/prompts/prompt-form-dialog";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deletePrompt } from "@/app/prompts/actions";
import { formatDate } from "@/lib/format";
import type { Project, Prompt } from "@/lib/database.types";

type PromptCardProps = {
  prompt: Prompt;
  tags: string[];
  projectName: string | null;
  authorName: string | null;
  projects: Project[];
  tagSuggestions: string[];
};

export function PromptCard({
  prompt,
  tags,
  projectName,
  authorName,
  projects,
  tagSuggestions,
}: PromptCardProps) {
  const [viewOpen, setViewOpen] = useState(false);

  function copyPrompt() {
    navigator.clipboard.writeText(prompt.prompt_text).then(
      () => toast.success("Prompt copied to clipboard."),
      () => toast.error("Couldn't copy to clipboard."),
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <Dialog open={viewOpen} onOpenChange={setViewOpen}>
            <DialogTrigger
              render={
                <button
                  type="button"
                  className="text-left font-medium leading-snug hover:underline"
                />
              }
            >
              {prompt.title}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{prompt.title}</DialogTitle>
                <DialogDescription>
                  {[
                    prompt.ai_tool,
                    projectName,
                    authorName,
                    formatDate(prompt.created_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
                <pre className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap break-words">
                  {prompt.prompt_text}
                </pre>
                {prompt.response_notes && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                      Result / notes
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {prompt.response_notes}
                    </p>
                  </div>
                )}
              </div>
              <Button onClick={copyPrompt} variant="outline">
                <Copy className="size-4" />
                Copy prompt
              </Button>
            </DialogContent>
          </Dialog>
          {prompt.rating != null && (
            <span className="shrink-0 text-sm text-amber-500">
              {"★".repeat(prompt.rating)}
            </span>
          )}
        </div>
        <CardDescription className="line-clamp-2">
          {prompt.prompt_text}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 pt-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {prompt.ai_tool && <Badge>{prompt.ai_tool}</Badge>}
          {projectName && <Badge variant="outline">{projectName}</Badge>}
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copyPrompt}
            aria-label="Copy prompt"
          >
            <Copy className="size-3.5" />
          </Button>
          <PromptFormDialog
            prompt={prompt}
            initialTags={tags}
            projects={projects}
            tagSuggestions={tagSuggestions}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Edit prompt">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <DeleteConfirmButton
            itemName={`"${prompt.title}"`}
            ariaLabel="Delete prompt"
            successMessage="Prompt deleted."
            onDelete={() => deletePrompt(prompt.id)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
