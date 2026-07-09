import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-[34px] py-[30px]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link
          href="/ideas"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--v2-ink-3)] transition-colors hover:text-[var(--v2-ink-1)]"
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
        <div className="mt-10 border-t pt-5" style={{ borderColor: "#ededeb" }}>
          <p className="font-mono-label mb-3">◇ Similar ideas</p>
          <div className="flex flex-col gap-2">
            {similar.map((s) => (
              <Link
                key={s.id}
                href={`/ideas/${s.id}`}
                className="flex items-center justify-between gap-2 rounded-[10px] bg-[var(--v2-rail-bg)] px-3.5 py-2.5 transition-colors hover:bg-[#f6f4f1]"
                style={{ border: "1px solid #ededeb" }}
              >
                <span className="truncate text-[12.5px] font-medium text-[var(--v2-ink-1)]">
                  {s.title}
                </span>
                {s.verdict && (
                  <span className="font-mono shrink-0 text-[10px] capitalize text-[var(--v2-ink-3)]">
                    {s.verdict}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 border-t pt-5" style={{ borderColor: "#ededeb" }}>
        <RelatedIdeas
          ideaId={idea.id}
          linked={linked}
          options={allIdeasRes.data ?? []}
        />
      </div>
    </main>
  );
}
