"use client";

import { useState, useTransition } from "react";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleCheck,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveStepToPrompts, toggleStepComplete } from "@/app/academy/actions";
import type { AcademyStepType } from "@/lib/database.types";

const STEP_TYPE_LABEL: Record<AcademyStepType, string> = {
  chat: "Chat",
  coding_agent: "Coding Agent",
  video: "Video",
};

export type StepRowData = {
  id: string;
  step_no: number;
  title: string;
  prompt_text: string;
  step_type: AcademyStepType;
};

type StepRowProps = {
  step: StepRowData;
  moduleId: string;
  doneBySelf: boolean;
  /** Names of teammates (not you) who completed this step. */
  doneByOthers: string[];
};

export function StepRow({ step, moduleId, doneBySelf, doneByOthers }: StepRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [savePending, startSave] = useTransition();

  function toggleDone() {
    startToggle(async () => {
      const { error } = await toggleStepComplete(step.id, !doneBySelf, moduleId);
      if (error) toast.error(error);
      else toast.success(doneBySelf ? "Step reopened." : "Step completed!");
    });
  }

  function copyPrompt() {
    navigator.clipboard.writeText(step.prompt_text).then(
      () => toast.success("Prompt copied to clipboard."),
      () => toast.error("Couldn't copy to clipboard."),
    );
  }

  function saveToPrompts() {
    startSave(async () => {
      const { error } = await saveStepToPrompts(step.id);
      if (error) toast.error(error);
      else toast.success("Saved to the prompt database.");
    });
  }

  return (
    <div className={cn("rounded-lg border p-3", doneBySelf && "bg-muted/40")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggleDone}
          disabled={togglePending}
          aria-label={doneBySelf ? "Mark step as not done" : "Mark step as done"}
          aria-pressed={doneBySelf}
          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {doneBySelf ? (
            <CircleCheck className="size-5 text-primary" />
          ) : (
            <Circle className="size-5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                doneBySelf && "text-muted-foreground line-through",
              )}
            >
              {step.step_no}. {step.title}
            </span>
            <Badge variant={step.step_type === "coding_agent" ? "default" : "secondary"}>
              {STEP_TYPE_LABEL[step.step_type]}
            </Badge>
            {doneByOthers.length > 0 && (
              <span
                className="text-xs text-muted-foreground"
                title={`Completed by ${doneByOthers.join(", ")}`}
              >
                ✓ {doneByOthers.join(", ")}
              </span>
            )}
          </div>
          <p
            className={cn(
              "mt-1 text-sm text-muted-foreground whitespace-pre-wrap",
              !expanded && "line-clamp-2",
            )}
          >
            {step.prompt_text}
          </p>
        </div>

        <div className="flex shrink-0 items-center">
          {step.step_type !== "video" && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={copyPrompt}
                aria-label="Copy prompt"
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={saveToPrompts}
                disabled={savePending}
                aria-label="Save to prompt database"
              >
                <BookmarkPlus className="size-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse prompt" : "Show full prompt"}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
