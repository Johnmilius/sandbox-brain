import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActor, resolveProject, supabase } from "../context.js";
import { fail, formatDuration, guarded, ok } from "../helpers.js";

export function registerTimeTools(server: McpServer): void {
  server.registerTool(
    "brain_start_timer",
    {
      title: "Start a work timer",
      description:
        "Start a live timer for the acting team member on a project (matched by name, partial names OK). " +
        "Fails if a timer is already running — stop it first with brain_stop_timer. " +
        "The timer shows up live in the web app and keeps running until stopped.",
      inputSchema: {
        project: z.string().min(1).describe("Project name (partial match OK)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async ({ project }) => {
      const [actor, proj] = await Promise.all([getActor(), resolveProject(project)]);
      const { error } = await supabase().from("time_entries").insert({
        user_id: actor.id,
        project_id: proj.id,
        started_at: new Date().toISOString(),
        source: "timer",
      });
      if (error) {
        if (error.code === "23505") {
          return fail(
            "You already have a running timer. Stop it with brain_stop_timer first.",
          );
        }
        return fail(error.message);
      }
      return ok(`Timer started on **${proj.name}**.`);
    }),
  );

  server.registerTool(
    "brain_stop_timer",
    {
      title: "Stop the running timer",
      description:
        "Stop the acting team member's running timer and log the session. Optionally attach a note about what was worked on. Returns the logged duration.",
      inputSchema: {
        notes: z
          .string()
          .max(2000)
          .optional()
          .describe("What was worked on (optional)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ notes }) => {
      const actor = await getActor();
      const db = supabase();
      const { data: running } = await db
        .from("time_entries")
        .select("id, started_at, project_id")
        .eq("user_id", actor.id)
        .is("ended_at", null)
        .maybeSingle();
      if (!running) {
        return fail("No timer is running. Start one with brain_start_timer.");
      }

      const endedAt = new Date().toISOString();
      const { error } = await db
        .from("time_entries")
        .update({ ended_at: endedAt, notes: notes?.trim() || null })
        .eq("id", running.id);
      if (error) return fail(error.message);

      const { data: proj } = await db
        .from("projects")
        .select("name")
        .eq("id", running.project_id)
        .maybeSingle();
      const duration = formatDuration(
        new Date(endedAt).getTime() - new Date(running.started_at).getTime(),
      );
      return ok(
        `Stopped. Logged **${duration}** on **${proj?.name ?? "the project"}**.`,
      );
    }),
  );

  server.registerTool(
    "brain_log_time",
    {
      title: "Log time manually",
      description:
        "Backfill a completed work session for the acting team member (no live timer involved). " +
        "Give the project, how long it took, and optionally the date (defaults to today) and start time (defaults to 09:00 local).",
      inputSchema: {
        project: z.string().min(1).describe("Project name (partial match OK)"),
        minutes: z
          .number()
          .int()
          .min(1)
          .max(24 * 60)
          .describe("Duration in minutes (e.g. 90 for an hour and a half)"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
          .optional()
          .describe("Session date, YYYY-MM-DD (default: today)"),
        start_time: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Use HH:MM (24h)")
          .default("09:00")
          .describe("Local start time, HH:MM 24h (default 09:00)"),
        notes: z.string().max(2000).optional().describe("What was worked on"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async ({ project, minutes, date, start_time, notes }) => {
      const [actor, proj] = await Promise.all([getActor(), resolveProject(project)]);

      const day = date ?? new Date().toISOString().slice(0, 10);
      const startedAt = new Date(`${day}T${start_time}`);
      if (Number.isNaN(startedAt.getTime())) {
        return fail(`Invalid date/time: ${day} ${start_time}.`);
      }
      const endedAt = new Date(startedAt.getTime() + minutes * 60_000);

      const { error } = await supabase().from("time_entries").insert({
        user_id: actor.id,
        project_id: proj.id,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        notes: notes?.trim() || null,
        source: "manual",
      });
      if (error) return fail(error.message);
      return ok(
        `Logged **${formatDuration(minutes * 60_000)}** on **${proj.name}** for ${day}.`,
      );
    }),
  );

  server.registerTool(
    "brain_time_summary",
    {
      title: "Summarize tracked time",
      description:
        "Team time report for the last N days: totals per person and per project, plus any currently running timers. " +
        "Use for questions like 'how much did we work this week?' or 'where is our time going?'.",
      inputSchema: {
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(7)
          .describe("How many days back to include (default 7)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ days }) => {
      const db = supabase();
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [entriesRes, projectsRes, profilesRes] = await Promise.all([
        db
          .from("time_entries")
          .select("user_id, project_id, started_at, ended_at")
          .gte("started_at", cutoff),
        db.from("projects").select("id, name"),
        db.from("profiles").select("id, full_name, email"),
      ]);
      if (entriesRes.error) return fail(entriesRes.error.message);

      const projectName = new Map(
        (projectsRes.data ?? []).map((p) => [p.id, p.name]),
      );
      const personName = new Map(
        (profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? p.email]),
      );

      const perPerson = new Map<string, number>();
      const perProject = new Map<string, number>();
      const runningBy: string[] = [];
      let totalMs = 0;

      for (const e of entriesRes.data ?? []) {
        if (!e.ended_at) {
          runningBy.push(
            `${personName.get(e.user_id) ?? "Unknown"} on ${projectName.get(e.project_id) ?? "unknown project"}`,
          );
          continue;
        }
        const ms =
          new Date(e.ended_at).getTime() - new Date(e.started_at).getTime();
        totalMs += ms;
        perPerson.set(e.user_id, (perPerson.get(e.user_id) ?? 0) + ms);
        perProject.set(e.project_id, (perProject.get(e.project_id) ?? 0) + ms);
      }

      const lines = [`# Time — last ${days} day${days === 1 ? "" : "s"}`, ""];
      lines.push(`**Team total:** ${formatDuration(totalMs)}`, "");
      if (perPerson.size > 0) {
        lines.push("## By person");
        for (const [id, ms] of [...perPerson.entries()].sort((a, b) => b[1] - a[1])) {
          lines.push(`- ${personName.get(id) ?? "Unknown"}: ${formatDuration(ms)}`);
        }
        lines.push("");
      }
      if (perProject.size > 0) {
        lines.push("## By project");
        for (const [id, ms] of [...perProject.entries()].sort((a, b) => b[1] - a[1])) {
          lines.push(`- ${projectName.get(id) ?? "Unknown"}: ${formatDuration(ms)}`);
        }
        lines.push("");
      }
      if (runningBy.length > 0) {
        lines.push(`## Running now`, ...runningBy.map((r) => `- ${r}`));
      }
      if (totalMs === 0 && runningBy.length === 0) {
        lines.push("No time logged in this window.");
      }
      return ok(lines.join("\n"));
    }),
  );
}
