import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProject, supabase } from "../context.js";
import { fail, guarded, ok } from "../helpers.js";

type EventRow = {
  actor_id: string | null;
  verb: string;
  object_type: string;
  object_id: string;
  object_label: string | null;
  target_type: string | null;
  target_label: string | null;
  source: string;
  occurred_at: string;
};

/** "logged_time" -> "logged time" */
function verbPhrase(verb: string): string {
  return verb.replace(/_/g, " ");
}

export function registerTimelineTools(server: McpServer): void {
  server.registerTool(
    "brain_timeline",
    {
      title: "Team activity timeline",
      description:
        "What happened in the hub, newest first — every create/update/complete/time-log " +
        "across projects, notes, prompts, knowledge, ideas, tasks, and the academy. " +
        "Filter by days back, person (name/email), and/or project. " +
        "Use to catch up ('what did the team do this week?') or to reconstruct the story of a project.",
      inputSchema: {
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(7)
          .describe("How many days back to include (default 7)"),
        person: z
          .string()
          .optional()
          .describe("Only this team member's activity (name or email, partial OK)"),
        project: z
          .string()
          .optional()
          .describe("Only activity scoped to this project (name, partial OK)"),
        limit: z.number().int().min(1).max(200).default(50),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ days, person, project, limit }) => {
      const db = supabase();
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      let q = db
        .from("events")
        .select(
          "actor_id, verb, object_type, object_id, object_label, target_type, target_label, source, occurred_at",
        )
        .gte("occurred_at", cutoff)
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (project) {
        const proj = await resolveProject(project);
        q = q.eq("project_id", proj.id);
      }

      const { data: profiles } = await db
        .from("profiles")
        .select("id, full_name, email");
      const nameById = new Map(
        (profiles ?? []).map((p: { id: string; full_name: string | null; email: string }) => [
          p.id,
          p.full_name ?? p.email,
        ]),
      );

      if (person) {
        const needle = person.trim().toLowerCase();
        const matches = (profiles ?? []).filter(
          (p: { id: string; full_name: string | null; email: string }) =>
            (p.full_name ?? "").toLowerCase().includes(needle) ||
            p.email.toLowerCase().includes(needle),
        );
        if (matches.length === 0) return fail(`No team member matches "${person}".`);
        if (matches.length > 1) {
          return fail(
            `"${person}" matches several people: ${matches
              .map((p: { full_name: string | null; email: string }) => p.full_name ?? p.email)
              .join(", ")}. Be more specific.`,
          );
        }
        q = q.eq("actor_id", matches[0].id);
      }

      const { data, error } = await q;
      if (error) {
        return fail(
          error.message.includes("events")
            ? `${error.message} — has migration 0009_events.sql been applied?`
            : error.message,
        );
      }
      const events = (data ?? []) as EventRow[];
      if (events.length === 0) {
        return ok(`No activity in the last ${days} day${days === 1 ? "" : "s"}.`);
      }

      const lines = events.map((e) => {
        const who = e.actor_id ? nameById.get(e.actor_id) ?? "Someone" : "System";
        const what = e.object_label ?? e.object_type.replace(/_/g, " ");
        const target = e.target_label ? ` → ${e.target_label}` : "";
        const via = e.source === "app" ? "" : ` _(via ${e.source})_`;
        const when = new Date(e.occurred_at).toISOString().slice(0, 16).replace("T", " ");
        return `- ${when} — **${who}** ${verbPhrase(e.verb)} ${what}${target}${via}`;
      });
      return ok(
        `# Timeline — last ${days} day${days === 1 ? "" : "s"} (${events.length} events)\n\n${lines.join("\n")}`,
      );
    }),
  );
}
