import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { IdeaEditor } from "@/components/ideas/idea-editor";
import { RelatedIdeas } from "@/components/ideas/related-ideas";
import { PromoteIdeaButton } from "@/components/ideas/promote-idea-button";
import { createClient } from "@/lib/supabase/server";

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ideaRes, allIdeasRes, linksRes, similarRes] = await Promise.all([
    supabase.from("ideas").select("*").eq("id", id).maybeSingle(),
    supabase.from("ideas").select("id, title").neq("id", id),
    supabase
      .from("links")
      .select("source_id, target_id")
      .eq("relationship", "related")
      .eq("source_type", "idea")
      .eq("target_type", "idea")
      .or(`source_id.eq.${id},target_id.eq.${id}`),
    supabase.rpc("find_similar_ideas", { p_idea_id: id, p_limit: 5 }),
  ]);

  const idea = ideaRes.data;
  if (!idea) notFound();

  const titleById = new Map((allIdeasRes.data ?? []).map((i) => [i.id, i.title]));
  const linkedIds = new Set(
    (linksRes.data ?? []).flatMap((l) => [l.source_id, l.target_id]).filter((x) => x !== id),
  );
  const linked = Array.from(linkedIds)
    .map((linkedId) => ({ id: linkedId, title: titleById.get(linkedId) }))
    .filter((l): l is { id: string; title: string } => Boolean(l.title));

  const similar = (similarRes.data ?? []).filter((s) => !linkedIds.has(s.id));

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
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Link
            href="/ideas"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            All ideas
          </Link>
          {idea.status !== "promoted" && (
            <PromoteIdeaButton ideaId={idea.id} title={idea.title} />
          )}
        </div>

        <IdeaEditor idea={idea} />

        {similar.length > 0 && (
          <div className="mt-10 border-t pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
              <Sparkles className="size-3.5" />
              Similar ideas
            </p>
            <ul className="flex flex-col gap-2">
              {similar.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Link
                    href={`/ideas/${s.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {s.title}
                  </Link>
                  {s.verdict && (
                    <Badge variant="outline" className="text-xs">
                      {s.verdict}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 border-t pt-4">
          <RelatedIdeas
            ideaId={idea.id}
            linked={linked}
            options={allIdeasRes.data ?? []}
          />
        </div>
      </main>
    </>
  );
}
