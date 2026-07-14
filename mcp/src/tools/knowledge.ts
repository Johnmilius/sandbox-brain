import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActor, resolveProject, supabase } from "../context.js";
import { emitMcpEvent, fail, guarded, ok, setTagsForEntity } from "../helpers.js";

export function registerKnowledgeTools(server: McpServer): void {
  server.registerTool(
    "brain_add_knowledge",
    {
      title: "Add to the knowledge base",
      description:
        "Save a reusable knowledge item to the Brain. Kinds: " +
        "code_snippet (set language + content=code), " +
        "decision (set outcome + content=what we tried and learned), " +
        "document (set url), contact (set contact_info + content=notes), " +
        "project_archive (set url=GitHub repo). " +
        "Use for anything the team will want to find and reuse in future projects.",
      inputSchema: {
        kind: z.enum([
          "code_snippet",
          "decision",
          "document",
          "contact",
          "project_archive",
        ]),
        title: z.string().min(1).max(200).describe("Title (or contact name)"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("What this is and when to reuse it (context for decisions)"),
        content: z
          .string()
          .optional()
          .describe("The code, decision write-up, or contact notes"),
        language: z
          .string()
          .optional()
          .describe("code_snippet only: programming language"),
        outcome: z
          .enum(["worked", "failed", "mixed"])
          .optional()
          .describe("decision only: how it turned out"),
        contact_info: z
          .string()
          .optional()
          .describe("contact only: email/phone/links"),
        url: z
          .string()
          .url()
          .optional()
          .describe("document/project_archive: external link or GitHub repo URL"),
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
    guarded(
      async ({
        kind,
        title,
        description,
        content,
        language,
        outcome,
        contact_info,
        url,
        project,
        tags,
      }) => {
        const actor = await getActor();
        const proj = project ? await resolveProject(project) : null;

        const data: Record<string, string> = {};
        if (kind === "code_snippet" && language) {
          data.language = language.trim().toLowerCase();
        }
        if (kind === "decision") data.outcome = outcome ?? "mixed";
        if (kind === "contact" && contact_info) data.contact_info = contact_info;

        const { data: created, error } = await supabase()
          .from("knowledge_items")
          .insert({
            kind,
            title: title.trim(),
            description: description?.trim() || null,
            content: content || null,
            data,
            url: url ?? null,
            project_id: proj?.id ?? null,
            created_by: actor.id,
          })
          .select("id")
          .single();
        if (error) return fail(error.message);

        await setTagsForEntity("knowledge_item", created.id, tags);
        await emitMcpEvent({
          verb: "created",
          object: { type: "knowledge_item", id: created.id, label: title.trim() },
          projectId: proj?.id ?? null,
          metadata: { kind },
        });
        return ok(
          `Added ${kind.replace("_", " ")} **${title.trim()}** to the brain` +
            `${proj ? ` (project: ${proj.name})` : ""}.`,
        );
      },
    ),
  );

  server.registerTool(
    "brain_search_knowledge",
    {
      title: "Search the knowledge base",
      description:
        "Full-text search over the Brain (code snippets, decisions, documents, contacts, project archives). " +
        "Optionally filter by kind. Returns full content for code and decisions.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Search terms (omit to list recent items)"),
        kind: z
          .enum([
            "code_snippet",
            "decision",
            "document",
            "contact",
            "project_archive",
          ])
          .optional()
          .describe("Filter to one kind"),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ query, kind, limit }) => {
      let q = supabase()
        .from("knowledge_items")
        .select("kind, title, description, content, data, url, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (query?.trim()) {
        q = q.textSearch("search_document", query.trim(), { type: "websearch" });
      }
      if (kind) q = q.eq("kind", kind);

      const { data, error } = await q;
      if (error) return fail(error.message);
      if (!data || data.length === 0) {
        return ok(query ? `Nothing in the brain matches "${query}".` : "The brain is empty so far.");
      }

      const blocks = data.map((item) => {
        const extra = (item.data ?? {}) as Record<string, string>;
        const meta = [
          item.kind.replace("_", " "),
          extra.language,
          extra.outcome,
          new Date(item.created_at).toISOString().slice(0, 10),
        ]
          .filter(Boolean)
          .join(" · ");
        const parts = [`## ${item.title}`, meta];
        if (item.description) parts.push(item.description);
        if (item.url) parts.push(`Link: ${item.url}`);
        if (extra.contact_info) parts.push(`Contact: ${extra.contact_info}`);
        if (item.content) {
          parts.push(
            item.kind === "code_snippet"
              ? `\`\`\`${extra.language ?? ""}\n${item.content}\n\`\`\``
              : item.content,
          );
        }
        return parts.join("\n\n");
      });
      return ok(`# Brain results (${data.length})\n\n${blocks.join("\n\n---\n\n")}`);
    }),
  );
}
