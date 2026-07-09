import Link from "next/link";
import { redirect } from "next/navigation";
import { Lightbulb, Plus, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { NewIdeaDialog } from "@/components/ideas/new-idea-dialog";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { IdeaStatus, IdeaVerdict } from "@/lib/database.types";

const STAGE_STYLE: Record<IdeaStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f4f2ef", fg: "var(--v2-ink-2)" },
  validating: { bg: "var(--v2-warning-bg)", fg: "var(--v2-warning-text-deep)" },
  promoted: { bg: "#1c1c1f", fg: "#ffffff" },
  archived: { bg: "#f4f2ef", fg: "var(--v2-ink-3)" },
};

const VERDICT_STYLE: Record<
  IdeaVerdict,
  { label: string; dot: string; fg: string }
> = {
  strong: { label: "Strong", dot: "#3f9b6c", fg: "var(--v2-success-text)" },
  conditional: { label: "Conditional", dot: "var(--v2-amber)", fg: "var(--v2-warning-text-deep)" },
  pass: { label: "Pass", dot: "var(--v2-danger)", fg: "var(--v2-danger)" },
};

export default async function IdeasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ideas, error } = await supabase
    .from("ideas")
    .select("*")
    .order("updated_at", { ascending: false });

  const newIdeaTrigger = (
    <NewIdeaDialog
      trigger={
        <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
          <Plus className="size-4" />
          New idea
        </Button>
      }
    />
  );

  return (
    <main className="mx-auto w-full max-w-[900px] flex-1 px-[34px] py-[30px]">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[29px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Ideas
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
            Raw concepts, fleshed out over time. Capture first — decide later.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/graph" />}
            className="rounded-full border-[#e2ddd6] bg-white px-4 text-[var(--v2-ink-1)] hover:bg-[#f6f4f1]"
          >
            <Waypoints className="size-4" />
            Graph
          </Button>
          {newIdeaTrigger}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load ideas: {error.message}
        </p>
      )}

      {ideas && ideas.length === 0 && (
        <EmptyState
          icon={Lightbulb}
          title="No ideas captured yet"
          description="Jot down the first draft — problem, customer, and solution can come later."
          action={newIdeaTrigger}
        />
      )}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(292px, 1fr))" }}
      >
        {ideas?.map((idea) => {
          const stage = STAGE_STYLE[idea.status];
          const verdict = idea.verdict ? VERDICT_STYLE[idea.verdict] : null;
          const ratedCount = Object.values(idea.scores).filter(
            (v) => v != null,
          ).length;
          return (
            <Link
              key={idea.id}
              href={`/ideas/${idea.id}`}
              className="block rounded-[13px] bg-white transition-shadow hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.16)]"
              style={{ border: "1px solid #ededeb", padding: "16px 18px" }}
            >
              <div className="flex items-center justify-between gap-2">
                {verdict ? (
                  <span
                    className="flex items-center gap-1.5 text-[11px] font-medium"
                    style={{ color: verdict.fg }}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: verdict.dot }}
                    />
                    {verdict.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] text-[var(--v2-ink-4)]">
                    <span className="size-2 rounded-full bg-[#e7e5e0]" />
                    No verdict
                  </span>
                )}
                <span className="font-mono shrink-0 text-[10px] text-[var(--v2-ink-3)]">
                  updated {formatDate(idea.updated_at)}
                </span>
              </div>

              <h2 className="mt-2.5 text-[15.5px] font-semibold leading-snug text-[var(--v2-ink-1)]">
                {idea.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-[var(--v2-ink-2)]">
                {idea.tagline || "No tagline yet."}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10.5px] font-medium capitalize"
                  style={{ backgroundColor: stage.bg, color: stage.fg }}
                >
                  {idea.status}
                </span>
                {ratedCount > 0 && (
                  <span className="font-mono text-[10px] text-[var(--v2-ink-label)]">
                    {ratedCount} of 7 rated
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
