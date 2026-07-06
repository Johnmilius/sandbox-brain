"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export type GraphNodeType =
  | "project"
  | "note"
  | "prompt"
  | "knowledge_item"
  | "profile"
  | "agent";

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

export const TYPE_COLORS: Record<GraphNodeType, string> = {
  project: "#3b82f6",
  note: "#22c55e",
  prompt: "#f59e0b",
  knowledge_item: "#a855f7",
  profile: "#94a3b8",
  agent: "#ec4899",
};

export const TYPE_LABELS: Record<GraphNodeType, string> = {
  project: "Projects",
  note: "Notes",
  prompt: "Prompts",
  knowledge_item: "Knowledge",
  profile: "People",
  agent: "Agents",
};

type PositionedNode = GraphNode & { x?: number; y?: number };

export function GraphView({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const router = useRouter();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-16rem)] min-h-96 w-full overflow-hidden rounded-lg border"
    >
      {size.width > 0 && (
        <ForceGraph2D
          width={size.width}
          height={size.height}
          graphData={{ nodes, links: edges }}
          nodeLabel={(node) => (node as PositionedNode).label}
          linkColor={(link) =>
            (link as GraphEdge).kind && (link as GraphEdge).kind !== "explicit"
              ? "#a855f733" // soft / suggested edges: fainter, purple-ish
              : "#9ca3af55"
          }
          linkLineDash={(link) =>
            (link as GraphEdge).kind && (link as GraphEdge).kind !== "explicit"
              ? [3, 3]
              : null
          }
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as PositionedNode;
            if (n.x == null || n.y == null) return;
            ctx.fillStyle = TYPE_COLORS[n.type] ?? "#94a3b8";
            ctx.beginPath();
            ctx.arc(n.x, n.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            if (globalScale > 0.8) {
              const fontSize = 11 / globalScale;
              ctx.font = `${fontSize}px sans-serif`;
              ctx.fillStyle = "#6b7280";
              ctx.textAlign = "center";
              ctx.fillText(n.label, n.x, n.y + 4 + fontSize);
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as PositionedNode;
            if (n.x == null || n.y == null) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 8, 0, 2 * Math.PI);
            ctx.fill();
          }}
          onNodeClick={(node) => {
            const n = node as PositionedNode;
            if (n.url) router.push(n.url);
          }}
        />
      )}
    </div>
  );
}
