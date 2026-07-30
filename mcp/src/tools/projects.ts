import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActor, supabase } from "../context.js";
import { emitMcpEvent, fail, guarded, ok } from "../helpers.js";

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    "brain_list_projects",
    {
      title: "List projects",
      description:
        "List every project/company in the Sandbox Brain hub with its status and description. " +
        "Use this to find the exact project name before starting timers, logging time, or attaching items.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async () => {
      const { data, error } = await supabase()
        .from("projects")
        .select("name, status, description, created_at")
        .order("created_at", { ascending: false });
      if (error) return fail(error.message);
      if (!data || data.length === 0) {
        return ok("No projects yet. Create one with brain_create_project.");
      }
      const lines = data.map(
        (p) =>
          `- **${p.name}** (${p.status})${p.description ? ` — ${p.description}` : ""}`,
      );
      return ok(`# Projects (${data.length})\n\n${lines.join("\n")}`);
    }),
  );

  server.registerTool(
    "brain_create_project",
    {
      title: "Create a project",
      description:
        "Create a new project/company in the hub. Fails with a hint if a similarly named project already exists — check brain_list_projects first.",
      inputSchema: {
        name: z.string().min(1).max(120).describe("Project name"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("What the project is about"),
        status: z
          .enum(["active", "paused", "completed", "archived"])
          .default("active")
          .describe("Project status (default active)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async ({ name, description, status }) => {
      const actor = await getActor();
      const db = supabase();

      const { data: existing } = await db
        .from("projects")
        .select("name")
        .ilike("name", `%${name.trim()}%`);
      if (existing && existing.length > 0) {
        return fail(
          `A similar project already exists: ${existing
            .map((p) => p.name)
            .join(", ")}. Use it, or pick a clearly different name.`,
        );
      }

      const { data, error } = await db
        .from("projects")
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          status,
          created_by: actor.id,
        })
        .select("id")
        .single();
      if (error) return fail(error.message);
      await emitMcpEvent({
        verb: "created",
        object: { type: "project", id: data.id, label: name.trim() },
        projectId: data.id,
      });
      return ok(`Created project **${name.trim()}** (${status}).`);
    }),
  );
}
