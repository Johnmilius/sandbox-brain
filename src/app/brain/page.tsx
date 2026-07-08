import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { KnowledgeCard } from "@/components/brain/knowledge-card";
import {
  KIND_LABELS,
  KnowledgeFormDialog,
} from "@/components/brain/knowledge-form-dialog";
import { createClient } from "@/lib/supabase/server";
import { getTagsByEntity } from "@/lib/tags";
import { cn } from "@/lib/utils";
import type { KnowledgeKind } from "@/lib/database.types";

const KIND_FILTERS: { value: KnowledgeKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "code_snippet", label: "Code" },
  { value: "decision", label: "Decisions" },
  { value: "document", label: "Documents" },
  { value: "contact", label: "Contacts" },
  { value: "project_archive", label: "Archives" },
];

const EXAMPLE_QUESTIONS = [
  "How do we run a launch?",
  "Why did we pick our stack?",
  "What's our voice?",
];

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("knowledge_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (kind && kind !== "all") {
    query = query.eq("kind", kind as KnowledgeKind);
  }

  const [itemsRes, projectsRes, tagsRes, itemTags] = await Promise.all([
    query,
    supabase.from("projects").select("*").order("name"),
    supabase.from("tags").select("name").order("name"),
    getTagsByEntity(supabase, "knowledge_item"),
  ]);

  const items = itemsRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const allTagNames = (tagsRes.data ?? []).map((t) => t.name);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            The brain
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
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
        className="mb-6 rounded-[13px] px-5 py-4"
        style={{
          background: "linear-gradient(180deg,#faf8ff,#fff)",
          border: "1px solid #e6ddf5",
        }}
      >
        <form action="/search" method="get" className="flex items-center gap-2">
          <Sparkles
            className="size-4 shrink-0"
            style={{ color: "var(--v2-accent-purple)" }}
          />
          <input
            type="search"
            name="q"
            placeholder="Ask the brain anything…"
            className="h-8 flex-1 bg-transparent text-[13px] text-[var(--v2-ink-1)] outline-none placeholder:text-[var(--v2-ink-3)]"
          />
          <span
            className="shrink-0 rounded border px-[5px] py-[1px] font-mono text-[9.5px] text-[var(--v2-ink-3)]"
            style={{ borderColor: "#e2ddd6" }}
          >
            ⌘K
          </span>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLE_QUESTIONS.map((question) => (
            <Link
              key={question}
              href={`/search?q=${encodeURIComponent(question)}`}
              className="rounded-full px-3 py-1 text-[11.5px] text-[var(--v2-ink-2)] transition-colors hover:text-[var(--v2-ink-1)]"
              style={{ backgroundColor: "#f4f2ef" }}
            >
              {question}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {KIND_FILTERS.map((f) => {
            const active = (kind ?? "all") === f.value;
            return (
              <Link
                key={f.value}
                href={f.value === "all" ? "/brain" : `/brain?kind=${f.value}`}
                className={cn(
                  "rounded-full px-3 py-1 text-[11.5px] transition-colors",
                  active
                    ? "bg-[#1c1c1f] font-medium text-white"
                    : "bg-[#f4f2ef] text-[var(--v2-ink-2)] hover:text-[var(--v2-ink-1)]",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <p className="font-mono text-[10px] text-[var(--v2-ink-3)] tabular-nums">
          {items.length} {kind && kind !== "all" ? "matching" : "canon"}{" "}
          {items.length === 1 ? "entry" : "entries"}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={
            kind && kind !== "all"
              ? `No ${KIND_LABELS[kind as KnowledgeKind]?.toLowerCase() ?? "matching"} items yet`
              : "The brain is empty"
          }
          description="Save code snippets, decisions, documents, contacts, and whole project archives so future-you can reuse them."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
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
            />
          ))}
        </div>
      )}
    </main>
  );
}
