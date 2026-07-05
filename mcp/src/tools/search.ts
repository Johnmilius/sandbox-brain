import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../context.js";
import { fail, guarded, ok } from "../helpers.js";

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    "brain_search",
    {
      title: "Search everything",
      description:
        "One full-text search across the whole hub: projects, notes, prompts, and the knowledge base. " +
        "Returns grouped hits with excerpts. Use the more specific search tools " +
        "(brain_search_prompts, brain_search_knowledge, brain_get_note) to drill into a result.",
      inputSchema: {
        query: z.string().min(1).describe("Search terms"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5)
          .describe("Max results per category (default 5)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ query, limit }) => {
      const db = supabase();
      const q = query.trim();

      const [projects, notes, prompts, knowledge] = await Promise.all([
        db
          .from("projects")
          .select("name, description")
          .textSearch("search_document", q, { type: "websearch" })
          .limit(limit),
        db
          .from("notes")
          .select("title, body")
          .textSearch("search_document", q, { type: "websearch" })
          .limit(limit),
        db
          .from("prompts")
          .select("title, prompt_text, ai_tool, rating")
          .textSearch("search_document", q, { type: "websearch" })
          .limit(limit),
        db
          .from("knowledge_items")
          .select("title, kind, description")
          .textSearch("search_document", q, { type: "websearch" })
          .limit(limit),
      ]);

      const firstError =
        projects.error ?? notes.error ?? prompts.error ?? knowledge.error;
      if (firstError) return fail(firstError.message);

      const sections: string[] = [];
      if (projects.data && projects.data.length > 0) {
        sections.push(
          `## Projects\n${projects.data
            .map((p) => `- **${p.name}**${p.description ? ` — ${p.description}` : ""}`)
            .join("\n")}`,
        );
      }
      if (notes.data && notes.data.length > 0) {
        sections.push(
          `## Notes\n${notes.data
            .map((n) => `- **${n.title}** — ${n.body.slice(0, 120).replace(/\s+/g, " ")}…`)
            .join("\n")}`,
        );
      }
      if (prompts.data && prompts.data.length > 0) {
        sections.push(
          `## Prompts\n${prompts.data
            .map(
              (p) =>
                `- **${p.title}**${p.ai_tool ? ` (${p.ai_tool}` : ""}${
                  p.rating != null ? `${p.ai_tool ? ", " : " ("}${"★".repeat(p.rating)}` : ""
                }${p.ai_tool || p.rating != null ? ")" : ""} — ${p.prompt_text
                  .slice(0, 100)
                  .replace(/\s+/g, " ")}…`,
            )
            .join("\n")}`,
        );
      }
      if (knowledge.data && knowledge.data.length > 0) {
        sections.push(
          `## Brain\n${knowledge.data
            .map(
              (k) =>
                `- **${k.title}** (${k.kind.replace("_", " ")})${
                  k.description ? ` — ${k.description}` : ""
                }`,
            )
            .join("\n")}`,
        );
      }

      if (sections.length === 0) {
        return ok(`No results for "${q}" anywhere in the hub.`);
      }
      return ok(`# Search: "${q}"\n\n${sections.join("\n\n")}`);
    }),
  );
}
