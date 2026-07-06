"use client";

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

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-snug">{agent.name}</span>
          {agent.status === "archived" && (
            <Badge variant="outline" className="shrink-0">
              archived
            </Badge>
          )}
        </div>
        {agent.description && (
          <CardDescription className="line-clamp-2">
            {agent.description}
          </CardDescription>
        )}
        {linkedPromptTitles.length > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            Uses: {linkedPromptTitles.join(", ")}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 pt-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {agent.model && <Badge>{agent.model}</Badge>}
          {projectName && <Badge variant="outline">{projectName}</Badge>}
          {agent.tools.map((tool) => (
            <Badge key={tool} variant="secondary">
              {tool}
            </Badge>
          ))}
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
            onClick={copySystemPrompt}
            aria-label="Copy system prompt"
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
              <Button variant="ghost" size="icon-sm" aria-label="Edit agent">
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
      </CardContent>
    </Card>
  );
}
