import { redirect } from "next/navigation";
import { Waypoints } from "lucide-react";
import { nodeKey, urlFor, type ObjectRef } from "@sandbox-brain/core";
import { EmptyState } from "@/components/empty-state";
import { GraphExplorer } from "@/components/graph/graph-explorer";
import type { GraphEdge, GraphNode } from "@/components/graph/graph-view";
import { getAuthedUser } from "@/lib/supabase/auth";

/** nodeKey + urlFor from the shared object contract (@sandbox-brain/core). */
function node(ref: ObjectRef): { id: string; url: string | null } {
  return { id: nodeKey(ref), url: urlFor(ref) };
}

export default async function GraphPage() {
  const { supabase, user } = await getAuthedUser();
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
    const nodeId = nodeKey({ type: t.entity_type, id: t.entity_id });
    const name = tagNameById.get(t.tag_id);
    if (!name) continue;
    (tagsByNode.get(nodeId) ?? tagsByNode.set(nodeId, []).get(nodeId)!).push(name);
    (nodesByTag.get(t.tag_id) ?? nodesByTag.set(t.tag_id, []).get(t.tag_id)!).push(nodeId);
  }

  const nodes: GraphNode[] = [
    ...(projects.data ?? []).map((p) => ({
      ...node({ type: "project", id: p.id }),
      label: p.name,
      type: "project" as const,
      projectId: p.id,
    })),
    ...(notes.data ?? []).map((n) => ({
      ...node({ type: "note", id: n.id }),
      label: n.title,
      type: "note" as const,
      authorId: n.author_id,
    })),
    ...(prompts.data ?? []).map((p) => ({
      ...node({ type: "prompt", id: p.id }),
      label: p.title,
      type: "prompt" as const,
      authorId: p.user_id,
      projectId: p.project_id ?? undefined,
    })),
    ...(knowledge.data ?? []).map((k) => ({
      ...node({ type: "knowledge_item", id: k.id }),
      label: k.title,
      type: "knowledge_item" as const,
      authorId: k.created_by,
      projectId: k.project_id ?? undefined,
    })),
    ...(profiles.data ?? []).map((p) => ({
      ...node({ type: "profile", id: p.id }),
      label: p.full_name ?? p.email,
      type: "profile" as const,
    })),
    ...(agents.data ?? []).map((a) => ({
      ...node({ type: "agent", id: a.id }),
      label: a.name,
      type: "agent" as const,
      authorId: a.created_by,
      projectId: a.project_id ?? undefined,
    })),
    ...(academyModules.data ?? []).map((m) => ({
      ...node({ type: "academy_module", id: m.id }),
      label: m.title,
      type: "academy_module" as const,
    })),
    ...(ideas.data ?? []).map((i) => ({
      ...node({ type: "idea", id: i.id }),
      label: i.title,
      type: "idea" as const,
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
    addEdge(
      nodeKey({ type: l.source_type, id: l.source_id }),
      nodeKey({ type: l.target_type, id: l.target_id }),
    );
  }
  // Implicit edges from structured relations.
  for (const p of prompts.data ?? []) {
    if (p.project_id)
      addEdge(nodeKey({ type: "prompt", id: p.id }), nodeKey({ type: "project", id: p.project_id }));
  }
  for (const k of knowledge.data ?? []) {
    if (k.project_id)
      addEdge(nodeKey({ type: "knowledge_item", id: k.id }), nodeKey({ type: "project", id: k.project_id }));
  }
  // Authorship: connect people to what they recorded, so "filter by person" works.
  for (const n of notes.data ?? []) {
    if (n.author_id)
      addEdge(nodeKey({ type: "profile", id: n.author_id }), nodeKey({ type: "note", id: n.id }));
  }
  for (const p of prompts.data ?? []) {
    if (p.user_id)
      addEdge(nodeKey({ type: "profile", id: p.user_id }), nodeKey({ type: "prompt", id: p.id }));
  }
  for (const k of knowledge.data ?? []) {
    if (k.created_by)
      addEdge(nodeKey({ type: "profile", id: k.created_by }), nodeKey({ type: "knowledge_item", id: k.id }));
  }
  for (const a of agents.data ?? []) {
    if (a.project_id)
      addEdge(nodeKey({ type: "agent", id: a.id }), nodeKey({ type: "project", id: a.project_id }));
    if (a.created_by)
      addEdge(nodeKey({ type: "profile", id: a.created_by }), nodeKey({ type: "agent", id: a.id }));
  }
  for (const i of ideas.data ?? []) {
    if (i.created_by)
      addEdge(nodeKey({ type: "profile", id: i.created_by }), nodeKey({ type: "idea", id: i.id }));
    if (i.promoted_project_id)
      addEdge(nodeKey({ type: "idea", id: i.id }), nodeKey({ type: "project", id: i.promoted_project_id }));
  }
  // People connect to projects they've logged time on.
  const worked = new Set(
    (timeEntries.data ?? []).map((t) => `${t.user_id}|${t.project_id}`),
  );
  for (const pair of worked) {
    const [userId, projectId] = pair.split("|");
    addEdge(nodeKey({ type: "profile", id: userId }), nodeKey({ type: "project", id: projectId }));
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
    addEdge(nodeKey({ type: "profile", id: userId }), nodeKey({ type: "academy_module", id: moduleId }));
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

  // Full-bleed canvas + right detail rail (design) — no boxed card.
  return nodes.length === 0 ? (
    <main className="mx-auto w-full max-w-6xl flex-1 px-[34px] py-[30px]">
      <EmptyState
        icon={Waypoints}
        title="Nothing to map yet"
        description="Add projects, notes, or prompts first — the graph draws itself from what the team saves."
      />
    </main>
  ) : (
    <GraphExplorer
      nodes={nodes}
      edges={edges}
      people={people}
      projects={projectOptions}
    />
  );
}
