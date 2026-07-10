"use client";

import { useState, useTransition } from "react";
import { Copy, Pencil, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

  // Design: one mono footer line — "{tag} · saved by {author}" (11px).
  const metaLine = [
    [prompt.ai_tool, projectName].filter(Boolean).join(" · ") || null,
    tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : null,
    authorName ? `saved by ${authorName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="flex flex-col rounded-[12px] bg-white"
      style={{ border: "1px solid #ededeb", padding: "16px 20px" }}
    >
      <div className="flex items-start justify-between gap-2">
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="text-left text-[14px] font-semibold leading-snug text-[var(--v2-ink-1)] hover:underline"
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
          <span
            className="shrink-0 text-[12px]"
            style={{ color: "var(--v2-amber)" }}
            aria-label={`${prompt.rating} out of 5 stars`}
          >
            {"★".repeat(prompt.rating)}
            {"☆".repeat(Math.max(0, 5 - prompt.rating))}
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-[12.5px] text-[var(--v2-ink-2)]">
        {prompt.prompt_text}
      </p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {metaLine && (
            <p className="font-mono truncate text-[11px] text-[var(--v2-ink-3)]">
              {metaLine}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleFavorite}
            disabled={favPending}
            aria-label={prompt.is_favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={prompt.is_favorite}
            className="hover:bg-[#efece7]"
          >
            <Star
              className={cn(
                "size-3.5",
                prompt.is_favorite
                  ? "fill-[var(--v2-amber)] text-[var(--v2-amber)]"
                  : "text-[var(--v2-ink-3)]",
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copyPrompt}
            aria-label="Copy prompt"
            className="text-[var(--v2-ink-3)] hover:bg-[#efece7] hover:text-[var(--v2-ink-1)]"
          >
            <Copy className="size-3.5" />
          </Button>
          <PromptFormDialog
            prompt={prompt}
            initialTags={tags}
            projects={projects}
            tagSuggestions={tagSuggestions}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit prompt"
                className="text-[var(--v2-ink-3)] hover:bg-[#efece7] hover:text-[var(--v2-ink-1)]"
              >
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
      </div>
    </div>
  );
}
