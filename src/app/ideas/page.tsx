import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/home-digest";
import {
  IdeasBrowser,
  type IdeaCardVM,
} from "@/components/ideas/ideas-browser";
import { IDEA_ACCENT } from "@/components/ideas/idea-meta";

export default async function IdeasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ideasRes, projectsRes, linksRes] = await Promise.all([
    supabase.from("ideas").select("*").order("updated_at", { ascending: false }),
    supabase.from("projects").select("id, name"),
    supabase
      .from("links")
      .select("source_id, target_id")
      .eq("relationship", "related")
      .eq("source_type", "idea")
      .eq("target_type", "idea"),
  ]);

  const ideas = ideasRes.data ?? [];
  const error = ideasRes.error;
  const projectName = new Map((projectsRes.data ?? []).map((p) => [p.id, p.name]));

  const relatedCount = new Map<string, number>();
  for (const l of linksRes.data ?? []) {
    relatedCount.set(l.source_id, (relatedCount.get(l.source_id) ?? 0) + 1);
    relatedCount.set(l.target_id, (relatedCount.get(l.target_id) ?? 0) + 1);
  }

  const now = new Date();
  const shortRelative = (iso: string) => {
    const label = relativeTime(iso, now);
    return label === "just now" ? "now" : label.replace(" ago", "");
  };

  const cards: IdeaCardVM[] = ideas.map((idea) => ({
    id: idea.id,
    title: idea.title,
    tagline: idea.tagline,
    status: idea.status,
    verdict: idea.verdict,
    scores: idea.scores,
    updatedLabel: shortRelative(idea.updated_at),
    promotedName: idea.promoted_project_id
      ? (projectName.get(idea.promoted_project_id) ?? null)
      : null,
    relatedCount: relatedCount.get(idea.id) ?? 0,
    sourceUrl: idea.source_url,
  }));

  return (
    <main className="mx-auto w-full max-w-[900px] flex-1 px-[34px] py-[30px]">
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <h1
            className="font-display text-[29px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Ideas
          </h1>
          <span
            className="flex size-6 items-center justify-center rounded-[7px] text-[13px]"
            style={{ backgroundColor: "#f2ecfd", color: IDEA_ACCENT }}
            aria-hidden
          >
            ◇
          </span>
        </div>
        <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
          Raw concepts, fleshed out over time. Capture first — decide later.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load ideas: {error.message}
        </p>
      )}

      {!error && <IdeasBrowser ideas={cards} />}
    </main>
  );
}
