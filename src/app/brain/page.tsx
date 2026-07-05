import Link from "next/link";
import { redirect } from "next/navigation";
import { Boxes, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
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
            <h1 className="text-2xl font-semibold tracking-tight">The Brain</h1>
            <p className="text-sm text-muted-foreground">
              Reusable knowledge from everything we&apos;ve built — searchable
              forever.
            </p>
          </div>
          <KnowledgeFormDialog
            projects={projects}
            tagSuggestions={allTagNames}
            trigger={
              <Button>
                <Plus className="size-4" />
                Add item
              </Button>
            }
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-1">
          {KIND_FILTERS.map((f) => {
            const active = (kind ?? "all") === f.value;
            return (
              <Link
                key={f.value}
                href={f.value === "all" ? "/brain" : `/brain?kind=${f.value}`}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-muted font-medium text-foreground",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <Boxes className="mx-auto size-8 text-muted-foreground" />
              <CardTitle>
                {kind && kind !== "all"
                  ? `No ${KIND_LABELS[kind as KnowledgeKind]?.toLowerCase() ?? "matching"} items yet`
                  : "The brain is empty"}
              </CardTitle>
              <CardDescription>
                Save code snippets, decisions, documents, contacts, and whole
                project archives so future-you can reuse them.
              </CardDescription>
            </CardHeader>
          </Card>
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
    </>
  );
}
