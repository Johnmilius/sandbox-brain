"use client";

import { useState, useTransition } from "react";
import { Copy, Pencil, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { deletePrompt, togglePromptFavorite } from "@/app/prompts/actions";
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
  const [favPending, startFav] = useTransition();

  function copyPrompt() {
    navigator.clipboard.writeText(prompt.prompt_text).then(
      () => toast.success("Prompt copied to clipboard."),
      () => toast.error("Couldn't copy to clipboard."),
    );
  }

  function toggleFavorite() {
    startFav(async () => {
      const { error } = await togglePromptFavorite(prompt.id, !prompt.is_favorite);
      if (error) toast.error(error);
      else toast.success(prompt.is_favorite ? "Removed from favorites." : "Added to favorites.");
    });
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
          <div className="flex shrink-0 items-center gap-1">
            {prompt.is_favorite && (
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
            )}
            {prompt.rating != null && (
              <span className="text-sm text-amber-500">
                {"★".repeat(prompt.rating)}
              </span>
            )}
          </div>
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
            onClick={toggleFavorite}
            disabled={favPending}
            aria-label={prompt.is_favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={prompt.is_favorite}
          >
            <Star
              className={cn(
                "size-3.5",
                prompt.is_favorite
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground",
              )}
            />
          </Button>
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
