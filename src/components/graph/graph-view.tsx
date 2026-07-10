"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export type GraphNodeType =
  | "project"
  | "note"
  | "prompt"
  | "knowledge_item"
  | "profile"
  | "agent"
  | "academy_module"
  | "idea";

export type GraphNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  url: string | null;
  /** Person who authored/created this item (profile id), for person filtering. */
  authorId?: string;
  /** Project this item belongs to (project id), for project filtering. */
  projectId?: string;
  /** Tag names on this item, for tag-based suggested links. */
  tags?: string[];
};

/** "explicit" = a real link/relation; the rest are computed, soft suggestions. */
export type GraphEdgeKind = "explicit" | "shared_tag" | "shared_project";

export type GraphEdge = {
  source: string;
  target: string;
  kind?: GraphEdgeKind;
};

// V2 palette per spec §1.1 graph legend. NOTE: globals.css chart-1..5 order
// does not match the legend order — these are mapped deliberately by type.
// knowledge_item / academy_module / idea have no design color; they extend
// the palette with V2 vocabulary (accent purple, locked tan, amber).
export const TYPE_COLORS: Record<GraphNodeType, string> = {
  project: "#1c1c1f",
  note: "#4a5b8a",
  prompt: "#8a6a2a",
  knowledge_item: "#5b3fd6",
  profile: "#3f7a56",
  agent: "#6a5f8a",
  academy_module: "#8a6a4a",
  idea: "#e0a53f",
};

export const TYPE_LABELS: Record<GraphNodeType, string> = {
  project: "Projects",
  note: "Notes",
  prompt: "Prompts",
  knowledge_item: "Knowledge",
  profile: "People",
  agent: "Agents",
  academy_module: "Academy",
  idea: "Ideas",
};

/** Design glyph drawn inside each node circle. */
export const TYPE_ICONS: Record<GraphNodeType, string> = {
  project: "▦",
  note: "✎",
  prompt: "❝",
  knowledge_item: "◍",
  profile: "☺",
  agent: "✦",
  academy_module: "▣",
  idea: "◇",
};

type PositionedNode = GraphNode & { x?: number; y?: number };
type LinkEnd = string | { id?: string };

const endId = (end: LinkEnd): string =>
  typeof end === "string" ? end : (end.id ?? "");

export function GraphView({
  nodes,
  edges,
  selectedId = null,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Focused node — drives the design's 3 visual states + focus rings. */
  selectedId?: string | null;
  onSelect?: (node: GraphNode | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Degree per node (design sizes circles by connection count) and the
  // adjacency of the selected node (for connected/unrelated states).
  const { degree, adjacent } = useMemo(() => {
    const degree = new Map<string, number>();
    const adjacent = new Set<string>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
      if (selectedId) {
        if (e.source === selectedId) adjacent.add(e.target);
        if (e.target === selectedId) adjacent.add(e.source);
      }
    }
    return { degree, adjacent };
  }, [edges, selectedId]);

  const touchesSelected = (link: object) => {
    if (!selectedId) return false;
    const l = link as { source: LinkEnd; target: LinkEnd };
    return endId(l.source) === selectedId || endId(l.target) === selectedId;
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 44%, #ffffff 0%, #faf9f7 62%, #f4f2ee 100%)",
      }}
    >
      {size.width > 0 && (
        <ForceGraph2D
          width={size.width}
          height={size.height}
          graphData={{ nodes, links: edges }}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={() => ""}
          linkColor={(link) => {
            if (touchesSelected(link)) return "rgba(91,63,214,0.65)";
            return (link as GraphEdge).kind &&
              (link as GraphEdge).kind !== "explicit"
              ? "#5b3fd633" // soft / suggested edges: fainter, accent purple
              : "#cfc9c052";
          }}
          linkWidth={(link) => (touchesSelected(link) ? 1.8 : 1.1)}
          linkLineDash={(link) =>
            (link as GraphEdge).kind && (link as GraphEdge).kind !== "explicit"
              ? [3, 3]
              : null
          }
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as PositionedNode;
            if (n.x == null || n.y == null) return;

            const color = TYPE_COLORS[n.type] ?? "#a8a29e";
            const deg = degree.get(n.id) ?? 0;
            // Design: 26px + 2.6px per connection (screen px, zoom-stable).
            const r = (26 + Math.min(deg, 8) * 2.6) / 2 / globalScale;
            const isSelected = n.id === selectedId;
            const isConnected = adjacent.has(n.id);
            const dimmed = !!selectedId && !isSelected && !isConnected;

            ctx.save();
            if (dimmed) ctx.globalAlpha = 0.55;

            // Focus rings around the selected node (190px / 290px).
            if (isSelected) {
              for (const [ringR, ringColor] of [
                [95, "#eae5dd"],
                [145, "#f1ede6"],
              ] as const) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, ringR / globalScale, 0, 2 * Math.PI);
                ctx.strokeStyle = ringColor;
                ctx.lineWidth = 1 / globalScale;
                ctx.stroke();
              }
            }

            // Circle: solid when selected, tinted white otherwise, grey when dimmed.
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
            if (isSelected) {
              ctx.shadowColor = color;
              ctx.shadowBlur = 12 / globalScale;
              ctx.fillStyle = color;
              ctx.fill();
              ctx.shadowBlur = 0;
            } else if (dimmed) {
              ctx.fillStyle = "#f4f2ef";
              ctx.fill();
              ctx.strokeStyle = "#d6d3cd";
              ctx.lineWidth = 1.5 / globalScale;
              ctx.stroke();
            } else {
              ctx.fillStyle = "#ffffff";
              ctx.fill();
              ctx.globalAlpha = (dimmed ? 0.55 : 1) * 0.12;
              ctx.fillStyle = color;
              ctx.fill();
              ctx.globalAlpha = dimmed ? 0.55 : 1;
              ctx.strokeStyle = color;
              ctx.lineWidth = 1.5 / globalScale;
              ctx.stroke();
            }

            // Type icon inside the circle.
            const iconSize = r * 1.05;
            ctx.font = `${iconSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = isSelected
              ? "#ffffff"
              : dimmed
                ? "#b5b3ad"
                : color;
            ctx.fillText(TYPE_ICONS[n.type] ?? "•", n.x, n.y);

            // Label below with a white halo (design text-shadow).
            const fontSize = 11 / globalScale;
            ctx.font = `${isSelected ? 600 : 400} ${fontSize}px sans-serif`;
            ctx.textBaseline = "top";
            const labelY = n.y + r + 6 / globalScale;
            ctx.lineWidth = 3 / globalScale;
            ctx.strokeStyle = "#ffffff";
            ctx.strokeText(n.label, n.x, labelY);
            ctx.fillStyle = isSelected
              ? "#1c1c1f"
              : dimmed
                ? "#b5b3ad"
                : "#78716c";
            ctx.fillText(n.label, n.x, labelY);
            ctx.restore();
          }}
          nodePointerAreaPaint={(node, color, ctx, globalScale) => {
            const n = node as PositionedNode;
            if (n.x == null || n.y == null) return;
            const deg = degree.get(n.id) ?? 0;
            const r = (26 + Math.min(deg, 8) * 2.6) / 2 / globalScale;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 4 / globalScale, 0, 2 * Math.PI);
            ctx.fill();
          }}
          onNodeClick={(node) => {
            onSelect?.(node as PositionedNode);
          }}
          onBackgroundClick={() => onSelect?.(null)}
        />
      )}
    </div>
  );
}
