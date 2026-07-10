import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { KnowledgeCard } from "@/components/brain/knowledge-card";
import { KnowledgeFormDialog } from "@/components/brain/knowledge-form-dialog";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/home-digest";
import { getTagsByEntity } from "@/lib/tags";
import type { KnowledgeKind } from "@/lib/database.types";

/**
 * The brain — the design's editorial canon: named categories (icon + blurb +
 * count) grouping 2-col entry cards with freshness dots, provenance stats,
 * and owner avatars. Categories map onto the knowledge kinds.
 */

const CATEGORIES: {
  kind: KnowledgeKind;
  name: string;
  icon: string;
  color: string;
  blurb: string;
}[] = [
  { kind: "document", name: "Playbooks", icon: "▶", color: "#4a5b8a", blurb: "Docs & guides — how we run things." },
  { kind: "decision", name: "Decisions", icon: "◈", color: "#6a5f8a", blurb: "Why we chose what we chose." },
  { kind: "code_snippet", name: "Standards", icon: "▤", color: "#8a6a2a", blurb: "Reusable code & patterns." },
  { kind: "contact", name: "Contacts", icon: "◎", color: "#3f7a56", blurb: "People & services we call on." },
  { kind: "project_archive", name: "Archives", icon: "◷", color: "#a8a29e", blurb: "Finished work, kept for reference." },
];

const EXAMPLE_QUESTIONS = [
  "How do we run a launch?",
  "Why did we pick our stack?",
  "What's our voice?",
];

/** Entries untouched for this long flip to "needs review". */
const STALE_AFTER_DAYS = 60;

export default async function BrainPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [itemsRes, projectsRes, tagsRes, itemTags, linksRes, profilesRes] =
    await Promise.all([
      supabase
        .from("knowledge_items")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("projects").select("*").order("name"),
      supabase.from("tags").select("name").order("name"),
      getTagsByEntity(supabase, "knowledge_item"),
      supabase
        .from("links")
        .select("source_type, source_id, target_type, target_id"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const items = itemsRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const allTagNames = (tagsRes.data ?? []).map((t) => t.name);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const profileById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? p.email]),
  );

  // Provenance: what each canon entry is distilled from (linked notes/tickets).
  const provenance = new Map<string, { notes: number; tickets: number }>();
  for (const l of linksRes.data ?? []) {
    const pairs: [string, string][] = [];
    if (l.source_type === "knowledge_item") pairs.push([l.source_id, l.target_type]);
    if (l.target_type === "knowledge_item") pairs.push([l.target_id, l.source_type]);
    for (const [itemId, otherType] of pairs) {
      const p = provenance.get(itemId) ?? { notes: 0, tickets: 0 };
      if (otherType === "note") p.notes += 1;
      if (otherType === "task") p.tickets += 1;
      provenance.set(itemId, p);
    }
  }
  const provenanceLabel = (itemId: string): string | null => {
    const p = provenance.get(itemId);
    if (!p || (p.notes === 0 && p.tickets === 0)) return null;
    const parts = [];
    if (p.notes > 0) parts.push(`${p.notes} note${p.notes === 1 ? "" : "s"}`);
    if (p.tickets > 0) parts.push(`${p.tickets} ticket${p.tickets === 1 ? "" : "s"}`);
    return `from ${parts.join(" · ")}`;
  };

  const now = new Date();
  const staleCutoff = now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const isCurrent = (updatedAt: string) =>
    new Date(updatedAt).getTime() >= staleCutoff;
  const currentCount = items.filter((i) => isCurrent(i.updated_at)).length;
  const staleCount = items.length - currentCount;

  const initialsFor = (label: string) =>
    label
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            The brain
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--v2-ink-2)]">
            The team&apos;s canon — durable knowledge promoted out of the daily
            churn, kept current.
          </p>
        </div>
        <KnowledgeFormDialog
          projects={projects}
          tagSuggestions={allTagNames}
          trigger={
            <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
              <Plus className="size-4" />
              Add item
            </Button>
          }
        />
      </div>

      {/* "Ask the brain" search card → routes to the existing /search page. */}
      <div
        className="mb-3 rounded-[12px]"
        style={{
          background: "linear-gradient(180deg,#faf8ff,#fff)",
          border: "1px solid #e6ddf5",
          padding: "15px 18px",
        }}
      >
        <form
          action="/search"
          method="get"
          className="flex h-[38px] items-center gap-2.5 rounded-[9px] bg-white px-[13px]"
          style={{ border: "1px solid #e2d9f2" }}
        >
          <Sparkles
            className="size-4 shrink-0"
            style={{ color: "var(--v2-accent-purple)" }}
          />
          <input
            type="search"
            name="q"
            placeholder="Ask the brain anything…"
            className="h-full flex-1 bg-transparent text-[13px] text-[var(--v2-ink-1)] outline-none placeholder:text-[var(--v2-ink-3)]"
          />
          <span
            className="font-mono shrink-0 rounded border px-1.5 py-px text-[9.5px]"
            style={{ borderColor: "#eae4f5", color: "#b5a8d6" }}
          >
            ⌘K
          </span>
        </form>
        <div className="mt-[11px] flex flex-wrap gap-[7px]">
          {EXAMPLE_QUESTIONS.map((question) => (
            <Link
              key={question}
              href={`/search?q=${encodeURIComponent(question)}`}
              className="rounded-[14px] px-[11px] py-[5px] text-[11.5px] transition-colors hover:bg-[#ece3fb]"
              style={{
                backgroundColor: "#f2ecfd",
                color: "var(--v2-accent-purple)",
              }}
            >
              {question}
            </Link>
          ))}
        </div>
      </div>

      {/* stats row */}
      <div className="mb-6 flex items-center gap-4 px-0.5">
        <span className="font-mono text-[11px] text-[var(--v2-ink-3)] tabular-nums">
          {items.length} canon {items.length === 1 ? "entry" : "entries"}
        </span>
        {items.length > 0 && (
          <>
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--v2-ink-3)]">
              <span
                className="size-[7px] rounded-full"
                style={{ backgroundColor: "#3f9b6c" }}
              />
              {currentCount} current
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--v2-ink-3)]">
              <span
                className="size-[7px] rounded-full"
                style={{ backgroundColor: "#e0a53f" }}
              />
              {staleCount} need review
            </span>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="The brain is empty"
          description="Save code snippets, decisions, documents, contacts, and whole project archives so future-you can reuse them."
        />
      ) : (
        CATEGORIES.map((cat) => {
          const entries = items.filter((i) => i.kind === cat.kind);
          if (entries.length === 0) return null;
          return (
            <section key={cat.kind} className="mb-[26px]">
              <div className="mb-3 flex items-center gap-[9px]">
                <span className="text-[13px]" style={{ color: cat.color }}>
                  {cat.icon}
                </span>
                <span className="text-[13.5px] font-semibold text-[var(--v2-ink-1)]">
                  {cat.name}
                </span>
                <span
                  className="font-mono rounded-[10px] px-[7px] py-px text-[10px] text-[var(--v2-ink-label)] tabular-nums"
                  style={{ backgroundColor: "#f4f2ef" }}
                >
                  {entries.length}
                </span>
                <span className="ml-0.5 text-[12px] text-[var(--v2-ink-3)]">
                  {cat.blurb}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {entries.map((item) => {
                  const owner = profileById.get(item.created_by);
                  return (
                    <KnowledgeCard
                      key={item.id}
                      item={item}
                      tags={itemTags.get(item.id) ?? []}
                      projectName={
                        item.project_id
                          ? (projectById.get(item.project_id)?.name ?? null)
                          : null
                      }
                      projects={projects}
                      tagSuggestions={allTagNames}
                      fresh={isCurrent(item.updated_at)}
                      provenance={provenanceLabel(item.id)}
                      ownerInitials={owner ? initialsFor(owner) : null}
                      ownerName={owner ?? null}
                      reviewedLabel={`updated ${relativeTime(item.updated_at, now)}`}
                    />
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
