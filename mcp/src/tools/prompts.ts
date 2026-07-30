import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActor, resolveProject, supabase } from "../context.js";
import { emitMcpEvent, fail, guarded, ok, setTagsForEntity } from "../helpers.js";

export function registerPromptTools(server: McpServer): void {
  server.registerTool(
    "brain_save_prompt",
    {
      title: "Save a prompt to the database",
      description:
        "Save an AI prompt to the team prompt database so it can be found and reused later. " +
        "Include the full prompt text, which AI tool it was for, how well it worked (1-5), and tags for filtering.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Short descriptive title"),
        prompt_text: z.string().min(1).describe("The full prompt text"),
        response_notes: z
          .string()
          .max(5000)
          .optional()
          .describe("How it went / what the result was"),
        ai_tool: z
          .string()
          .max(50)
          .optional()
          .describe("Which AI tool (claude, chatgpt, claude-code, cursor, …)"),
        rating: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("How well it worked, 1 (bad) to 5 (great)"),
        project: z
          .string()
          .optional()
          .describe("Project name to attach it to (partial match OK)"),
        tags: z.array(z.string()).default([]).describe("Tags for filtering"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async ({ title, prompt_text, response_notes, ai_tool, rating, project, tags }) => {
      const actor = await getActor();
      const proj = project ? await resolveProject(project) : null;

      const { data, error } = await supabase()
        .from("prompts")
        .insert({
          user_id: actor.id,
          project_id: proj?.id ?? null,
          title: title.trim(),
          prompt_text,
          response_notes: response_notes?.trim() || null,
          ai_tool: ai_tool?.trim().toLowerCase() || null,
          rating: rating ?? null,
        })
        .select("id")
        .single();
      if (error) return fail(error.message);

      await setTagsForEntity("prompt", data.id, tags);
      await emitMcpEvent({
        verb: "created",
        object: { type: "prompt", id: data.id, label: title.trim() },
        projectId: proj?.id ?? null,
      });
      return ok(
        `Saved prompt **${title.trim()}**${proj ? ` (project: ${proj.name})` : ""}${
          tags.length > 0 ? ` [${tags.join(", ")}]` : ""
        }.`,
      );
    }),
  );

  server.registerTool(
    "brain_search_prompts",
    {
      title: "Search the prompt database",
      description:
        "Full-text search over the team's saved prompts (titles, prompt text, result notes). " +
        "Optionally filter by AI tool. Returns titles, ratings, tools, and prompt text.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Search terms (omit to list the most recent prompts)"),
        ai_tool: z.string().optional().describe("Filter by AI tool name"),
        favorites_only: z
          .boolean()
          .default(false)
          .describe(
            "Only return team-favorited (canonical) prompts — the vetted ones to reuse",
          ),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ query, ai_tool, favorites_only, limit }) => {
      let q = supabase()
        .from("prompts")
        .select(
          "title, prompt_text, response_notes, ai_tool, rating, is_favorite, created_at",
        )
        .order("is_favorite", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (query?.trim()) {
        q = q.textSearch("search_document", query.trim(), { type: "websearch" });
      }
      if (ai_tool?.trim()) q = q.eq("ai_tool", ai_tool.trim().toLowerCase());
      if (favorites_only) q = q.eq("is_favorite", true);

      const { data, error } = await q;
      if (error) return fail(error.message);
      if (!data || data.length === 0) {
        return ok(
          query
            ? `No prompts match "${query}". Try broader terms or no query for recent prompts.`
            : "The prompt database is empty so far.",
        );
      }

      const blocks = data.map((p) => {
        const meta = [
          p.is_favorite ? "★ favorite" : null,
          p.ai_tool,
          p.rating != null ? `${"★".repeat(p.rating)}` : null,
          new Date(p.created_at).toISOString().slice(0, 10),
        ]
          .filter(Boolean)
          .join(" · ");
        const notes = p.response_notes ? `\n> ${p.response_notes}` : "";
        return `## ${p.title}\n${meta}\n\n\`\`\`\n${p.prompt_text}\n\`\`\`${notes}`;
      });
      return ok(`# Prompts (${data.length})\n\n${blocks.join("\n\n")}`);
    }),
  );
}
