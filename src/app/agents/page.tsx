import { redirect } from "next/navigation";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentFormDialog } from "@/components/agents/agent-form-dialog";
import { createClient } from "@/lib/supabase/server";
import { getTagsByEntity } from "@/lib/tags";

export default async function AgentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [agentsRes, projectsRes, tagsRes, agentTags, promptsRes, linksRes] =
    await Promise.all([
      supabase.from("agents").select("*").order("status").order("name"),
      supabase.from("projects").select("*").order("name"),
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
  const allTagNames = (tagsRes.data ?? []).map((t) => t.name);
  const prompts = promptsRes.data ?? [];
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const promptById = new Map(prompts.map((p) => [p.id, p]));

  const promptIdsByAgent = new Map<string, string[]>();
  for (const l of linksRes.data ?? []) {
    const list = promptIdsByAgent.get(l.source_id) ?? [];
    list.push(l.target_id);
    promptIdsByAgent.set(l.source_id, list);
  }

  const name =
    (user.user_metadata.full_name as string | undefined) ??
    (user.user_metadata.name as string | undefined);

  return (
    <>
      <AppHeader
        email={user.email ?? ""}
        name={name}
        avatarUrl={user.user_metadata.avatar_url as string | undefined}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
            <p className="text-sm text-muted-foreground">
              {agents.length} saved — reusable AI agents and the prompts they use.
            </p>
          </div>
          <AgentFormDialog
            projects={projects}
            prompts={prompts}
            tagSuggestions={allTagNames}
            trigger={
              <Button>
                <Plus className="size-4" />
                Save agent
              </Button>
            }
          />
        </div>

        {agents.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <Bot className="mx-auto size-8 text-muted-foreground" />
              <CardTitle>No agents yet</CardTitle>
              <CardDescription>
                Save the AI agents your team uses — system prompt, model, and the
                prompts they rely on — so they stay consistent.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => {
              const linkedPromptIds = promptIdsByAgent.get(agent.id) ?? [];
              const linkedPromptTitles = linkedPromptIds
                .map((id) => promptById.get(id)?.title)
                .filter((t): t is string => Boolean(t));
              return (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  tags={agentTags.get(agent.id) ?? []}
                  linkedPromptIds={linkedPromptIds}
                  linkedPromptTitles={linkedPromptTitles}
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
          </div>
        )}
      </main>
    </>
  );
}
