"use client";

import { Bot, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AgentFormDialog } from "@/components/agents/agent-form-dialog";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteAgent } from "@/app/agents/actions";
import type { Agent, Project } from "@/lib/database.types";

type PromptOption = { id: string; title: string; is_favorite: boolean };

type AgentCardProps = {
  agent: Agent;
  tags: string[];
  linkedPromptIds: string[];
  linkedPromptTitles: string[];
  ownerName: string | null;
  projectName: string | null;
  projects: Project[];
  prompts: PromptOption[];
  tagSuggestions: string[];
};

export function AgentCard({
  agent,
  tags,
  linkedPromptIds,
  linkedPromptTitles,
  ownerName,
  projectName,
  projects,
  prompts,
  tagSuggestions,
}: AgentCardProps) {
  function copySystemPrompt() {
    if (!agent.system_prompt) {
      toast.error("This agent has no system prompt yet.");
      return;
    }
    navigator.clipboard.writeText(agent.system_prompt).then(
      () => toast.success("System prompt copied."),
      () => toast.error("Couldn't copy to clipboard."),
    );
  }

  const chips = [...agent.tools, ...tags];

  const ownerInitials = ownerName
    ? ownerName
        .split(/[\s@.]+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : null;
  const ownerFirstName = ownerName?.split(/\s+/)[0] ?? null;

  return (
    <div
      className="flex flex-col gap-3 rounded-[13px] bg-white p-4"
      style={{ border: "1px solid #ededeb" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: "#f1eefc", color: "#6a5f8a" }}
          aria-hidden
        >
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-[var(--v2-ink-1)]">
              {agent.name}
            </span>
            {agent.status === "archived" && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                style={{ backgroundColor: "#f4f2ef", color: "var(--v2-ink-2)" }}
              >
                archived
              </span>
            )}
          </div>
          {(agent.model || projectName) && (
            <p className="font-mono text-[10.5px] text-[var(--v2-ink-3)]">
              {[agent.model, projectName].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {agent.description && (
        <p className="line-clamp-2 text-[13px] text-[var(--v2-ink-2)]">
          {agent.description}
        </p>
      )}

      {chips.length > 0 && (
        <div>
          <p className="font-mono-label mb-1.5">Tools &amp; access</p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-[6px] px-2 py-0.5 text-[10.5px] text-[var(--v2-ink-2)]"
                style={{ backgroundColor: "#f4f2ef" }}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}

      {agent.system_prompt && (
        <div className="rounded-[9px] p-2.5" style={{ backgroundColor: "#faf9f7" }}>
          <p className="font-mono-label mb-1">System prompt</p>
          <p className="line-clamp-2 text-[12px] text-[var(--v2-ink-2)] italic">
            {agent.system_prompt}
          </p>
        </div>
      )}

      <div
        className="flex items-center justify-between gap-2 pt-2"
        style={{ borderTop: "1px solid #f4f2ef" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {ownerInitials && (
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
              style={{ backgroundColor: "#e7e5e0", color: "#57534e" }}
              title={ownerName ?? undefined}
            >
              {ownerInitials}
            </span>
          )}
          {ownerFirstName && (
            <span className="truncate text-[12.5px] text-[var(--v2-ink-2)]">
              {ownerFirstName}
            </span>
          )}
          {linkedPromptTitles.length > 0 && (
            <span
              className="font-mono shrink-0 text-[10px]"
              style={{ color: "var(--v2-accent-purple)" }}
              title={linkedPromptTitles.join(", ")}
            >
              ◍ used in {linkedPromptTitles.length} prompt
              {linkedPromptTitles.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copySystemPrompt}
            aria-label="Copy system prompt"
            className="text-[var(--v2-ink-3)] hover:bg-[#efece7] hover:text-[var(--v2-ink-1)]"
          >
            <Copy className="size-3.5" />
          </Button>
          <AgentFormDialog
            agent={agent}
            initialTags={tags}
            initialPromptIds={linkedPromptIds}
            projects={projects}
            prompts={prompts}
            tagSuggestions={tagSuggestions}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit agent"
                className="text-[var(--v2-ink-3)] hover:bg-[#efece7] hover:text-[var(--v2-ink-1)]"
              >
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <DeleteConfirmButton
            itemName={`agent "${agent.name}"`}
            ariaLabel="Delete agent"
            successMessage="Agent deleted."
            onDelete={() => deleteAgent(agent.id)}
          />
        </div>
      </div>
    </div>
  );
}
