import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import {
  GraphView,
  TYPE_COLORS,
  type GraphEdge,
  type GraphNode,
} from "@/components/graph/graph-view";
import { createClient } from "@/lib/supabase/server";

const TYPE_LABELS: Record<GraphNode["type"], string> = {
  project: "Projects",
  note: "Notes",
  prompt: "Prompts",
  knowledge_item: "Knowledge",
  profile: "People",
};

export default async function GraphPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [projects, notes, prompts, knowledge, profiles, links, timeEntries] =
    await Promise.all([
      supabase.from("projects").select("id, name"),
      supabase.from("notes").select("id, title"),
      supabase.from("prompts").select("id, title, project_id"),
      supabase.from("knowledge_items").select("id, title, project_id"),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("links").select("source_type, source_id, target_type, target_id"),
      supabase.from("time_entries").select("user_id, project_id"),
    ]);

  const nodes: GraphNode[] = [
    ...(projects.data ?? []).map((p) => ({
      id: `project:${p.id}`,
      label: p.name,
      type: "project" as const,
      url: "/projects",
    })),
    ...(notes.data ?? []).map((n) => ({
      id: `note:${n.id}`,
      label: n.title,
      type: "note" as const,
      url: `/notes/${n.id}`,
    })),
    ...(prompts.data ?? []).map((p) => ({
      id: `prompt:${p.id}`,
      label: p.title,
      type: "prompt" as const,
      url: "/prompts",
    })),
    ...(knowledge.data ?? []).map((k) => ({
      id: `knowledge_item:${k.id}`,
      label: k.title,
      type: "knowledge_item" as const,
      url: "/brain",
    })),
    ...(profiles.data ?? []).map((p) => ({
      id: `profile:${p.id}`,
      label: p.full_name ?? p.email,
      type: "profile" as const,
      url: null,
    })),
  ];
  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges: GraphEdge[] = [];
  function addEdge(source: string, target: string) {
    if (nodeIds.has(source) && nodeIds.has(target)) {
      edges.push({ source, target });
    }
  }

  // Explicit edges (wiki-links and future manual links).
  for (const l of links.data ?? []) {
    addEdge(`${l.source_type}:${l.source_id}`, `${l.target_type}:${l.target_id}`);
  }
  // Implicit edges from structured relations.
  for (const p of prompts.data ?? []) {
    if (p.project_id) addEdge(`prompt:${p.id}`, `project:${p.project_id}`);
  }
  for (const k of knowledge.data ?? []) {
    if (k.project_id) addEdge(`knowledge_item:${k.id}`, `project:${k.project_id}`);
  }
  // People connect to projects they've logged time on.
  const worked = new Set(
    (timeEntries.data ?? []).map((t) => `${t.user_id}|${t.project_id}`),
  );
  for (const pair of worked) {
    const [userId, projectId] = pair.split("|");
    addEdge(`profile:${userId}`, `project:${projectId}`);
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Graph</h1>
            <p className="text-sm text-muted-foreground">
              Everything in the brain and how it connects. Click a node to open it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {(Object.keys(TYPE_LABELS) as GraphNode["type"][]).map((type) => (
              <span key={type} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                {TYPE_LABELS[type]}
              </span>
            ))}
          </div>
        </div>

        {nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to show yet — add projects, notes, or prompts first.
          </p>
        ) : (
          <GraphView nodes={nodes} edges={edges} />
        )}
      </main>
    </>
  );
}
