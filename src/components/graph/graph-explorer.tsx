"use client";

import { useMemo, useState } from "react";
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={personId} onValueChange={(v) => setPersonId(v as string)}>
          <SelectTrigger aria-label="Filter by person" className="min-w-40">
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
          <SelectTrigger aria-label="Filter by project" className="min-w-40">
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

        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={showSuggested}
            onChange={(e) => setShowSuggested(e.target.checked)}
          />
          Suggested links
        </label>
      </div>

      {/* Legend doubles as type toggles. */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {NODE_TYPES.map((type) => {
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-opacity",
                active ? "opacity-100" : "opacity-40",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[type] }}
              />
              {TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      {visibleNodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing matches these filters. Try clearing person/project or enabling
          more types.
        </p>
      ) : (
        <GraphView nodes={visibleNodes} edges={visibleEdges} />
      )}
    </div>
  );
}
