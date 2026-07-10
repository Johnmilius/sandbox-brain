"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  GraphView,
  TYPE_COLORS,
  TYPE_LABELS,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
} from "@/components/graph/graph-view";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

const ALL = "__all__";
const NODE_TYPES = Object.keys(TYPE_LABELS) as GraphNodeType[];

/** Singular noun per type for the detail panel eyebrow + open link. */
const TYPE_NOUN: Record<GraphNodeType, string> = {
  project: "Project",
  note: "Note",
  prompt: "Prompt",
  knowledge_item: "Knowledge",
  profile: "Person",
  agent: "Agent",
  academy_module: "Academy module",
  idea: "Idea",
};

export function GraphExplorer({
  nodes,
  edges,
  people,
  projects,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  people: Option[];
  projects: Option[];
}) {
  const [activeTypes, setActiveTypes] = useState<Set<GraphNodeType>>(
    () => new Set(NODE_TYPES),
  );
  const [personId, setPersonId] = useState<string>(ALL);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [showSuggested, setShowSuggested] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function toggleType(type: GraphNodeType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const explicitEdges = edges.filter(
      (e) => showSuggested || !e.kind || e.kind === "explicit",
    );

    // Adjacency over the (currently in-scope) edges for one-hop focus expansion.
    const neighbors = new Map<string, Set<string>>();
    const link = (a: string, b: string) => {
      let set = neighbors.get(a);
      if (!set) {
        set = new Set();
        neighbors.set(a, set);
      }
      set.add(b);
    };
    for (const e of explicitEdges) {
      link(e.source, e.target);
      link(e.target, e.source);
    }

    // 1. Focus set from person/project filters (empty filters = everything).
    let focus: Set<string> | null = null;
    if (personId !== ALL) {
      focus = new Set<string>([`profile:${personId}`]);
      for (const n of nodes) if (n.authorId === personId) focus.add(n.id);
    }
    if (projectId !== ALL) {
      const projFocus = new Set<string>([`project:${projectId}`]);
      for (const n of nodes) if (n.projectId === projectId) projFocus.add(n.id);
      focus = focus
        ? new Set([...focus].filter((id) => projFocus.has(id)))
        : projFocus;
    }

    // 2. Expand one hop so a focused node keeps its immediate context.
    let keep: Set<string>;
    if (focus) {
      keep = new Set(focus);
      for (const id of focus) {
        for (const nb of neighbors.get(id) ?? []) keep.add(nb);
      }
    } else {
      keep = new Set(nodes.map((n) => n.id));
    }

    // 3. Apply type toggles, then copy so react-force-graph mutates only copies.
    const visibleNodes = nodes
      .filter((n) => keep.has(n.id) && activeTypes.has(n.type))
      .map((n) => ({ ...n }));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = explicitEdges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, kind: e.kind }));

    return { visibleNodes, visibleEdges };
  }, [nodes, edges, activeTypes, personId, projectId, showSuggested]);

  // Selection survives filter changes only while the node stays visible.
  const selected =
    (selectedId && visibleNodes.find((n) => n.id === selectedId)) || null;

  const connections = useMemo(() => {
    if (!selected) return [];
    const byId = new Map(visibleNodes.map((n) => [n.id, n]));
    const out: GraphNode[] = [];
    const seen = new Set<string>();
    for (const e of visibleEdges) {
      const otherId =
        e.source === selected.id
          ? e.target
          : e.target === selected.id
            ? e.source
            : null;
      if (!otherId || seen.has(otherId)) continue;
      seen.add(otherId);
      const other = byId.get(otherId);
      if (other) out.push(other);
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [selected, visibleNodes, visibleEdges]);

  return (
    <div className="flex min-h-0 flex-1">
      {/* canvas */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* title overlay */}
        <div className="pointer-events-none absolute top-[22px] left-[26px] z-[5]">
          <h1 className="font-display text-[24px] text-[var(--v2-ink-1)]">
            The graph
          </h1>
          <p className="text-[12.5px] text-[var(--v2-ink-2)]">
            {visibleEdges.length} connections · drag the nodes around
          </p>
        </div>

        {/* filters overlay */}
        <div className="absolute top-[18px] right-[20px] z-[5] flex flex-wrap items-center justify-end gap-2">
          <Select value={personId} onValueChange={(v) => setPersonId(v as string)}>
            <SelectTrigger
              aria-label="Filter by person"
              className="h-8 min-w-36 bg-white text-[12px]"
            >
              <SelectValue>
                {(v: string | null) =>
                  v && v !== ALL
                    ? (people.find((p) => p.id === v)?.label ?? "Person")
                    : "All people"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All people</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
            <SelectTrigger
              aria-label="Filter by project"
              className="h-8 min-w-36 bg-white text-[12px]"
            >
              <SelectValue>
                {(v: string | null) =>
                  v && v !== ALL
                    ? (projects.find((p) => p.id === v)?.label ?? "Project")
                    : "All projects"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-[11.5px] text-[var(--v2-ink-2)] select-none"
            style={{ border: "1px solid #e2ddd6" }}
          >
            <input
              type="checkbox"
              checked={showSuggested}
              onChange={(e) => setShowSuggested(e.target.checked)}
            />
            Suggested links
          </label>
        </div>

        {visibleNodes.length === 0 ? (
          <div
            className="flex h-full items-center justify-center"
            style={{
              background:
                "radial-gradient(circle at 50% 44%, #ffffff 0%, #faf9f7 62%, #f4f2ee 100%)",
            }}
          >
            <p className="text-[13px] text-[var(--v2-ink-3)]">
              Nothing matches these filters. Try clearing person/project or
              enabling more types.
            </p>
          </div>
        ) : (
          <GraphView
            nodes={visibleNodes}
            edges={visibleEdges}
            selectedId={selected?.id ?? null}
            onSelect={(node) => setSelectedId(node?.id ?? null)}
          />
        )}

        {/* legend (doubles as type toggles), bottom-left inside the canvas */}
        <div className="absolute bottom-4 left-5 z-[3] flex flex-wrap items-center gap-3.5">
          {NODE_TYPES.map((type) => {
            const active = activeTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={active}
                className={cn(
                  "font-mono flex cursor-pointer items-center gap-[5px] text-[10.5px] tracking-[0.05em] uppercase transition-opacity",
                  active ? "opacity-100" : "opacity-35",
                )}
                style={{ color: "var(--v2-ink-3)" }}
              >
                <span
                  className="size-[7px] rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                {TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* detail panel */}
      <aside
        className="w-[270px] shrink-0 border-l"
        style={{
          borderColor: "#f0eeeb",
          backgroundColor: "var(--v2-rail-bg)",
          padding: "26px 22px",
        }}
      >
        {selected ? (
          <>
            <p
              className="font-mono mb-2 text-[10px] tracking-[0.14em] uppercase"
              style={{ color: TYPE_COLORS[selected.type] }}
            >
              {TYPE_NOUN[selected.type]}
            </p>
            <h2 className="font-display mb-[3px] text-[23px] leading-tight text-[var(--v2-ink-1)]">
              {selected.label}
            </h2>
            <p className="font-mono mb-5 text-[11px] text-[var(--v2-ink-3)]">
              {connections.length} connection{connections.length === 1 ? "" : "s"}
            </p>

            <p className="font-mono-label mb-[11px]">Connected to</p>
            <div className="flex flex-col gap-0.5">
              {connections.length === 0 ? (
                <p className="text-[12px] text-[var(--v2-ink-4)]">
                  No visible connections.
                </p>
              ) : (
                connections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="flex cursor-pointer items-center gap-[9px] rounded-[8px] px-[9px] py-2 text-left text-[12.5px] text-[var(--v2-ink-1)] transition-colors hover:bg-[#faf9f7]"
                  >
                    <span
                      className="size-[7px] flex-none rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[c.type] }}
                    />
                    <span className="truncate">{c.label}</span>
                  </button>
                ))
              )}
            </div>

            {selected.url && (
              <Link
                href={selected.url}
                className="mt-[18px] inline-block text-[12.5px] hover:underline"
                style={{ color: "var(--v2-accent-purple)" }}
              >
                Open {TYPE_NOUN[selected.type].toLowerCase()} →
              </Link>
            )}
          </>
        ) : (
          <>
            <p className="font-mono-label mb-2">Inspector</p>
            <p className="text-[12.5px] leading-relaxed text-[var(--v2-ink-3)]">
              Click a node to focus it — its connections light up here, the
              rest of the graph dims.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
