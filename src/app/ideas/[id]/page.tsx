import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { IdeaEditor } from "@/components/ideas/idea-editor";
import { IdeaMetaStrip } from "@/components/ideas/idea-meta-strip";
import { IdeaScoring } from "@/components/ideas/idea-scoring";
import { PromoteBanner } from "@/components/ideas/promote-banner";
import { RelatedIdeas } from "@/components/ideas/related-ideas";
import { verdictMeta } from "@/components/ideas/idea-meta";
import { HistoryPanel } from "@/components/history-panel";
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
    supabase.from("ideas").select("id, title, tagline, verdict").neq("id", id),
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

  const allIdeas = allIdeasRes.data ?? [];
  const ideaById = new Map(allIdeas.map((i) => [i.id, i]));
  const linkedIds = new Set(
    (linksRes.data ?? [])
      .flatMap((l) => [l.source_id, l.target_id])
      .filter((x) => x !== id),
  );
  const linked = Array.from(linkedIds)
    .map((linkedId) => {
      const other = ideaById.get(linkedId);
      return other ? { id: other.id, title: other.title } : null;
    })
    .filter((l): l is { id: string; title: string } => l !== null);

  const similar = (similarRes.data ?? [])
    .filter((s) => !linkedIds.has(s.id))
    .slice(0, 3);
  const maxRank = similar.length > 0 ? Math.max(...similar.map((s) => s.rank)) : 1;

  let promotedName: string | null = null;
  if (idea.promoted_project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", idea.promoted_project_id)
      .maybeSingle();
    promotedName = project?.name ?? null;
  }

  return (
    <div className="flex min-h-full flex-1">
      {/* main canvas */}
      <main className="min-w-0 flex-1 px-8 pt-[26px] pb-11">
        <div className="mb-4">
          <Link
            href="/ideas"
            className="inline-flex items-center gap-1 text-[12.5px] text-[var(--v2-ink-3)] transition-colors hover:text-[var(--v2-ink-1)]"
          >
            <ArrowLeft className="size-3.5" />
            All ideas
          </Link>
        </div>

        <IdeaEditor
          idea={idea}
          metaSlot={
            <IdeaMetaStrip
              ideaId={idea.id}
              verdict={idea.verdict}
              status={idea.status}
              sourceUrl={idea.source_url}
            />
          }
          bannerSlot={
            idea.status === "archived" ? null : (
              <PromoteBanner
                ideaId={idea.id}
                promoted={idea.status === "promoted"}
                promotedName={promotedName}
              />
            )
          }
          scoringSlot={<IdeaScoring ideaId={idea.id} scores={idea.scores} />}
        />
      </main>

      {/* right rail: similar + related + graph */}
      <aside
        className="hidden w-[300px] shrink-0 border-l lg:block"
        style={{
          borderColor: "#f0eeeb",
          backgroundColor: "var(--v2-rail-bg)",
          padding: "26px 22px",
        }}
      >
        <p
          className="font-mono mb-1 text-[10px] tracking-[0.13em] uppercase"
          style={{ color: "var(--v2-accent-purple)" }}
        >
          ◇ Similar ideas
        </p>
        <p className="mb-3.5 text-[11px] text-[var(--v2-ink-3)]">
          Auto-ranked by text overlap
        </p>
        <div className="mb-7 flex flex-col gap-[9px]">
          {similar.length === 0 ? (
            <p className="text-[12px] leading-normal text-[var(--v2-ink-4)]">
              Add more detail to the problem, customer, and solution to
              surface similar ideas.
            </p>
          ) : (
            similar.map((s) => {
              const pct = Math.round((s.rank / maxRank) * 100);
              return (
                <Link
                  key={s.id}
                  href={`/ideas/${s.id}`}
                  className="block rounded-[10px] bg-white px-3 py-[11px] transition-colors hover:border-[#d9d4f0] hover:bg-[#faf8ff]"
                  style={{ border: "1px solid #ededeb" }}
                >
                  <div className="mb-[5px] flex items-center gap-2">
                    <span
                      className="size-[7px] flex-none rounded-full"
                      style={{
                        backgroundColor: verdictMeta(s.verdict).dot,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--v2-ink-1)]">
                      {s.title}
                    </span>
                    <span
                      className="font-mono flex-none text-[10.5px]"
                      style={{ color: "var(--v2-accent-purple)" }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="mb-2 line-clamp-1 text-[11px] leading-[1.4] text-[var(--v2-ink-3)]">
                    {s.tagline || "No pitch yet"}
                  </div>
                  <div
                    className="h-[3px] rounded-[2px]"
                    style={{ backgroundColor: "#efece7" }}
                  >
                    <div
                      className="h-full rounded-[2px] opacity-55"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: "var(--v2-accent-purple)",
                      }}
                    />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <RelatedIdeas
          ideaId={idea.id}
          linked={linked}
          options={allIdeas.map(({ id: optionId, title }) => ({
            id: optionId,
            title,
          }))}
        />

        <div
          className="mt-[26px] border-t pt-[18px]"
          style={{ borderColor: "#f0eeeb" }}
        >
          <p className="font-mono mb-2.5 text-[10px] tracking-[0.13em] text-[var(--v2-ink-label)] uppercase">
            ◷ In the graph
          </p>
          <Link
            href="/graph"
            className="text-[12.5px] hover:underline"
            style={{ color: "var(--v2-accent-purple)" }}
          >
            Open this idea in the graph →
          </Link>
        </div>

        <HistoryPanel objectType="idea" objectId={id} />
      </aside>
    </div>
  );
}
