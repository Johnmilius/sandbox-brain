"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Non-destructive tag suggestions: surfaces existing tag names that appear as
 * whole words in the given text and aren't already selected. Click to add.
 */
export function TagSuggestions({
  text,
  vocabulary,
  selected,
  onAdd,
  max = 8,
}: {
  text: string;
  vocabulary: string[];
  selected: string[];
  onAdd: (tag: string) => void;
  max?: number;
}) {
  const matches = vocabulary
    .filter(
      (tag) =>
        tag.length >= 2 &&
        !selected.includes(tag) &&
        new RegExp(`\\b${escapeRegExp(tag)}\\b`, "i").test(text),
    )
    .slice(0, max);

  if (matches.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Suggested:</span>
      {matches.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onAdd(tag)}
          aria-label={`Add tag ${tag}`}
        >
          <Badge
            variant="outline"
            className="gap-1 hover:border-foreground/25 hover:bg-muted"
          >
            <Plus className="size-3" />
            {tag}
          </Badge>
        </button>
      ))}
    </div>
  );
}
