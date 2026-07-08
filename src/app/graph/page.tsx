import { redirect } from "next/navigation";
import { Waypoints } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { GraphExplorer } from "@/components/graph/graph-explorer";
import type { GraphEdge, GraphNode } from "@/components/graph/graph-view";
import { createClient } from "@/lib/supabase/server";

export default async function GraphPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    projects,
    notes,
    prompts,
    knowledge,
    profiles,
    agents,
    ideas,
    links,
    timeEntries,
    taggables,
    tags,
    academyModules,
    academySteps,
    academyProgress,
  ] = await Promise.all([
    supabase.from("projects").select("id, name"),
    supabase.from("notes").select("id, title, author_id"),
    supabase.from("prompts").select("id, title, project_id, user_id"),
    supabase.from("knowledge_items").select("id, title, project_id, created_by"),
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("agents").select("id, name, project_id, created_by"),
    supabase.from("ideas").select("id, title, created_by, promoted_project_id"),
    supabase.from("links").select("source_type, source_id, target_type, target_id"),
    supabase.from("time_entries").select("user_id, project_id"),
    supabase.from("taggables").select("entity_type, entity_id, tag_id"),
    supabase.from("tags").select("id, name"),
    supabase.from("academy_modules").select("id, title"),
    supabase.from("academy_steps").select("id, module_id"),
    supabase.from("academy_step_progress").select("user_id, step_id"),
  ]);

  // node id (`type:id`) -> tag names, for attaching to nodes + shared-tag edges.
  const tagNameById = new Map((tags.data ?? []).map((t) => [t.id, t.name]));
  const tagsByNode = new Map<string, string[]>();
  const nodesByTag = new Map<string, string[]>();
  for (const t of taggables.data ?? []) {
    const nodeId = `${t.entity_type}:${t.entity_id}`;
    const name = tagNameById.get(t.tag_id);
    if (!name) continue;
    (tagsByNode.get(nodeId) ?? tagsByNode.set(nodeId, []).get(nodeId)!).push(name);
    (nodesByTag.get(t.tag_id) ?? nodesByTag.set(t.tag_id, []).get(t.tag_id)!).push(nodeId);
  }

  const nodes: GraphNode[] = [
    ...(projects.data ?? []).map((p) => ({
      id: `project:${p.id}`,
      label: p.name,
      type: "project" as const,
      url: "/projects",
      projectId: p.id,
    })),
    ...(notes.data ?? []).map((n) => ({
      id: `note:${n.id}`,
      label: n.title,
      type: "note" as const,
      url: `/notes/${n.id}`,
      authorId: n.author_id,
    })),
    ...(prompts.data ?? []).map((p) => ({
      id: `prompt:${p.id}`,
      label: p.title,
      type: "prompt" as const,
      url: "/prompts",
      authorId: p.user_id,
      projectId: p.project_id ?? undefined,
    })),
    ...(knowledge.data ?? []).map((k) => ({
      id: `knowledge_item:${k.id}`,
      label: k.title,
      type: "knowledge_item" as const,
      url: "/brain",
      authorId: k.created_by,
      projectId: k.project_id ?? undefined,
    })),
    ...(profiles.data ?? []).map((p) => ({
      id: `profile:${p.id}`,
      label: p.full_name ?? p.email,
      type: "profile" as const,
      url: null,
    })),
    ...(agents.data ?? []).map((a) => ({
      id: `agent:${a.id}`,
      label: a.name,
      type: "agent" as const,
      url: "/agents",
      authorId: a.created_by,
      projectId: a.project_id ?? undefined,
    })),
    ...(academyModules.data ?? []).map((m) => ({
      id: `academy_module:${m.id}`,
      label: m.title,
      type: "academy_module" as const,
      url: `/academy/${m.id}`,
    })),
    ...(ideas.data ?? []).map((i) => ({
      id: `idea:${i.id}`,
      label: i.title,
      type: "idea" as const,
      url: `/ideas/${i.id}`,
      authorId: i.created_by,
    })),
  ];
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const n of nodes) n.tags = tagsByNode.get(n.id);

  const edges: GraphEdge[] = [];
  // Dedupe undirected pairs so an explicit edge suppresses a redundant soft one.
  const pairSeen = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  function addEdge(source: string, target: string) {
    if (source === target || !nodeIds.has(source) || !nodeIds.has(target)) return;
    const key = pairKey(source, target);
    if (pairSeen.has(key)) return;
    pairSeen.add(key);
    edges.push({ source, target, kind: "explicit" });
  }

  function addSoftEdge(source: string, target: string, kind: GraphEdge["kind"]) {
    if (source === target || !nodeIds.has(source) || !nodeIds.has(target)) return;
    const key = pairKey(source, target);
    if (pairSeen.has(key)) return;
    pairSeen.add(key);
    edges.push({ source, target, kind });
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
  // Authorship: connect people to what they recorded, so "filter by person" works.
  for (const n of notes.data ?? []) {
    if (n.author_id) addEdge(`profile:${n.author_id}`, `note:${n.id}`);
  }
  for (const p of prompts.data ?? []) {
    if (p.user_id) addEdge(`profile:${p.user_id}`, `prompt:${p.id}`);
  }
  for (const k of knowledge.data ?? []) {
    if (k.created_by) addEdge(`profile:${k.created_by}`, `knowledge_item:${k.id}`);
  }
  for (const a of agents.data ?? []) {
    if (a.project_id) addEdge(`agent:${a.id}`, `project:${a.project_id}`);
    if (a.created_by) addEdge(`profile:${a.created_by}`, `agent:${a.id}`);
  }
  for (const i of ideas.data ?? []) {
    if (i.created_by) addEdge(`profile:${i.created_by}`, `idea:${i.id}`);
    if (i.promoted_project_id) addEdge(`idea:${i.id}`, `project:${i.promoted_project_id}`);
  }
  // People connect to projects they've logged time on.
  const worked = new Set(
    (timeEntries.data ?? []).map((t) => `${t.user_id}|${t.project_id}`),
  );
  for (const pair of worked) {
    const [userId, projectId] = pair.split("|");
    addEdge(`profile:${userId}`, `project:${projectId}`);
  }
  // People connect to academy modules they've completed steps in.
  const moduleByStep = new Map(
    (academySteps.data ?? []).map((s) => [s.id, s.module_id]),
  );
  const studied = new Set(
    (academyProgress.data ?? [])
      .map((p) => {
        const moduleId = moduleByStep.get(p.step_id);
        return moduleId ? `${p.user_id}|${moduleId}` : null;
      })
      .filter((pair): pair is string => pair !== null),
  );
  for (const pair of studied) {
    const [userId, moduleId] = pair.split("|");
    addEdge(`profile:${userId}`, `academy_module:${moduleId}`);
  }

  // Suggested (soft) edges: items that share a tag. Skip tags used so widely
  // they'd just add a hairball; connect members pairwise, capped per tag.
  const MAX_TAG_MEMBERS = 8; // ignore tags on more than this many items
  const MAX_PAIRS_PER_TAG = 20;
  for (const members of nodesByTag.values()) {
    const unique = [...new Set(members)].filter((id) => nodeIds.has(id));
    if (unique.length < 2 || unique.length > MAX_TAG_MEMBERS) continue;
    let added = 0;
    for (let i = 0; i < unique.length && added < MAX_PAIRS_PER_TAG; i++) {
      for (let j = i + 1; j < unique.length && added < MAX_PAIRS_PER_TAG; j++) {
        addSoftEdge(unique[i], unique[j], "shared_tag");
        added++;
      }
    }
  }

  const people = (profiles.data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? p.email,
  }));
  const projectOptions = (projects.data ?? []).map((p) => ({
    id: p.id,
    label: p.name,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-[34px] py-[30px]">
      <div className="mb-5">
        <h1
          className="font-display text-[24px] text-[var(--v2-ink-1)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          The graph
        </h1>
        <p className="mt-1 text-[12.5px] text-[var(--v2-ink-2)]">
          {edges.length} connections · drag the nodes around
        </p>
      </div>

      {nodes.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          title="Nothing to map yet"
          description="Add projects, notes, or prompts first — the graph draws itself from what the team saves."
        />
      ) : (
        <GraphExplorer
          nodes={nodes}
          edges={edges}
          people={people}
          projects={projectOptions}
        />
      )}
    </main>
  );
}
