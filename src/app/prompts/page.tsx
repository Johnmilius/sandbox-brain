import { redirect } from "next/navigation";
import { MessageSquareText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptFilters } from "@/components/prompts/prompt-filters";
import { PromptFormDialog } from "@/components/prompts/prompt-form-dialog";
import { getAuthedUser } from "@/lib/supabase/auth";
import { getTagsByEntity } from "@/lib/tags";

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tool?: string; tag?: string; favorite?: string }>;
}) {
  const { q, tool, tag, favorite } = await searchParams;
  const favoriteOnly = favorite === "1";
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("prompts")
    .select("*")
    // Favorites float to the top, newest-first within each group.
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.textSearch("search_document", q, { type: "websearch" });
  if (tool) query = query.eq("ai_tool", tool);
  if (favoriteOnly) query = query.eq("is_favorite", true);

  const [promptsRes, projectsRes, profilesRes, tagsRes, promptTags] =
    await Promise.all([
      query,
      supabase.from("projects").select("*").order("name"),
      supabase.from("profiles").select("*"),
      supabase.from("tags").select("name").order("name"),
      getTagsByEntity(supabase, "prompt"),
    ]);

  const projects = projectsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const allTagNames = (tagsRes.data ?? []).map((t) => t.name);

  let prompts = promptsRes.data ?? [];
  if (tag) {
    prompts = prompts.filter((p) => (promptTags.get(p.id) ?? []).includes(tag));
  }

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // Lightweight insights over the current result set.
  const rated = prompts.filter((p) => p.rating != null);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length).toFixed(1)
      : null;
  const byTool = new Map<string, number>();
  for (const p of prompts) {
    if (p.ai_tool) byTool.set(p.ai_tool, (byTool.get(p.ai_tool) ?? 0) + 1);
  }
  const distinctTools = [...byTool.keys()].sort();
  const favoriteCount = prompts.filter((p) => p.is_favorite).length;

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Prompt library
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
            {prompts.length} saved
            {favoriteCount > 0 && ` · ★ ${favoriteCount} favorite${favoriteCount === 1 ? "" : "s"}`}
            {avgRating && ` · ${avgRating} avg rating`}
            {distinctTools.length > 0 && ` · ${distinctTools.join(", ")}`}
          </p>
        </div>
        <PromptFormDialog
          projects={projects}
          tagSuggestions={allTagNames}
          trigger={
            <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
              <Plus className="size-4" />
              Save prompt
            </Button>
          }
        />
      </div>

      <div className="mb-5">
        <PromptFilters tools={distinctTools} tags={allTagNames} />
      </div>

      {prompts.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title={q || tool || tag || favoriteOnly ? "No prompts match" : "No prompts yet"}
          description={
            q || tool || tag || favoriteOnly
              ? "Try clearing the search or filters."
              : "Save the prompts you send to AI tools so the team can reuse what works."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {prompts.map((prompt) => {
            const author = profileById.get(prompt.user_id);
            return (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                tags={promptTags.get(prompt.id) ?? []}
                projectName={
                  prompt.project_id
                    ? (projectById.get(prompt.project_id)?.name ?? null)
                    : null
                }
                authorName={author?.full_name ?? author?.email ?? null}
                projects={projects}
                tagSuggestions={allTagNames}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
