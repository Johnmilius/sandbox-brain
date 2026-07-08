import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Plus, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentFormDialog } from "@/components/agents/agent-form-dialog";
import { createClient } from "@/lib/supabase/server";
import { getTagsByEntity } from "@/lib/tags";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const automationsTab = tab === "automations";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [agentsRes, projectsRes, profilesRes, tagsRes, agentTags, promptsRes, linksRes] =
    await Promise.all([
      supabase.from("agents").select("*").order("status").order("name"),
      supabase.from("projects").select("*").order("name"),
      supabase.from("profiles").select("*"),
      supabase.from("tags").select("name").order("name"),
      getTagsByEntity(supabase, "agent"),
      supabase
        .from("prompts")
        .select("id, title, is_favorite")
        .order("is_favorite", { ascending: false })
        .order("title"),
      supabase
        .from("links")
        .select("source_id, target_id")
        .eq("source_type", "agent")
        .eq("target_type", "prompt")
        .eq("relationship", "uses"),
    ]);

  const agents = agentsRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const allTagNames = (tagsRes.data ?? []).map((t) => t.name);
  const prompts = promptsRes.data ?? [];
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const promptById = new Map(prompts.map((p) => [p.id, p]));

  const promptIdsByAgent = new Map<string, string[]>();
  for (const l of linksRes.data ?? []) {
    const list = promptIdsByAgent.get(l.source_id) ?? [];
    list.push(l.target_id);
    promptIdsByAgent.set(l.source_id, list);
  }

  const newAgentTrigger = (
    <AgentFormDialog
      projects={projects}
      prompts={prompts}
      tagSuggestions={allTagNames}
      trigger={
        <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
          <Plus className="size-4" />
          Save agent
        </Button>
      }
    />
  );

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Agents
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
            {automationsTab
              ? "Scheduled agents and recurring jobs — hands-off work."
              : "The coding agents the team builds with — configured, shared, reusable."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex items-center rounded-[9px] p-0.5"
            style={{ backgroundColor: "#efece7" }}
            role="tablist"
            aria-label="Agent views"
          >
            <Link
              href="/agents"
              role="tab"
              aria-selected={!automationsTab}
              className={cn(
                "rounded-[7px] px-3 py-1 text-[12px] transition-colors",
                !automationsTab
                  ? "bg-white font-medium text-[var(--v2-ink-1)] shadow-sm"
                  : "text-[var(--v2-ink-2)] hover:text-[var(--v2-ink-1)]",
              )}
            >
              Dev agents
            </Link>
            <Link
              href="/agents?tab=automations"
              role="tab"
              aria-selected={automationsTab}
              className={cn(
                "rounded-[7px] px-3 py-1 text-[12px] transition-colors",
                automationsTab
                  ? "bg-white font-medium text-[var(--v2-ink-1)] shadow-sm"
                  : "text-[var(--v2-ink-2)] hover:text-[var(--v2-ink-1)]",
              )}
            >
              Automations
            </Link>
          </div>
          {!automationsTab && newAgentTrigger}
        </div>
      </div>

      {automationsTab ? (
        <EmptyState
          icon={Workflow}
          title="No automations yet"
          description="Recurring jobs — digests, nudges, curators — will live here once the team schedules its first one."
        />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Save the AI agents your team uses — system prompt, model, and the prompts they rely on — so they stay consistent."
          action={newAgentTrigger}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => {
            const linkedPromptIds = promptIdsByAgent.get(agent.id) ?? [];
            const linkedPromptTitles = linkedPromptIds
              .map((id) => promptById.get(id)?.title)
              .filter((t): t is string => Boolean(t));
            const owner = profileById.get(agent.created_by);
            return (
              <AgentCard
                key={agent.id}
                agent={agent}
                tags={agentTags.get(agent.id) ?? []}
                linkedPromptIds={linkedPromptIds}
                linkedPromptTitles={linkedPromptTitles}
                ownerName={owner?.full_name ?? owner?.email ?? null}
                projectName={
                  agent.project_id
                    ? (projectById.get(agent.project_id)?.name ?? null)
                    : null
                }
                projects={projects}
                prompts={prompts}
                tagSuggestions={allTagNames}
              />
            );
          })}
          <AgentFormDialog
            projects={projects}
            prompts={prompts}
            tagSuggestions={allTagNames}
            trigger={
              <button
                type="button"
                className="flex min-h-[140px] flex-col items-center justify-center gap-1.5 rounded-[13px] text-[13px] text-[var(--v2-ink-3)] transition-colors hover:border-[var(--v2-ink-4)] hover:text-[var(--v2-ink-2)]"
                style={{ border: "1px dashed #d6d3cd" }}
              >
                <Plus className="size-4" />
                Register a new agent
              </button>
            }
          />
        </div>
      )}
    </main>
  );
}
