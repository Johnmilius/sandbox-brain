import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActor, supabase } from "../context.js";
import { emitMcpEvent, fail, formatDuration, guarded, ok } from "../helpers.js";

const TIER_LABELS = ["Novice", "Developing", "Strong", "Advanced"] as const;
const TIER_BY_WORD: Record<string, number> = {
  novice: 1,
  developing: 2,
  strong: 3,
  advanced: 4,
};

const STEP_TYPE_TAG: Record<string, string> = {
  chat: "[Chat]",
  coding_agent: "[Coding Agent]",
  video: "[Video]",
};

type ModuleRow = { id: string; title: string; kind: string; sort_order: number };
type StepRow = {
  id: string;
  module_id: string;
  step_no: number;
  title: string;
  prompt_text: string;
  step_type: string;
};

/** Modules + steps, steps sorted curriculum order (module sort, then step no). */
async function loadCurriculum(): Promise<{
  modules: ModuleRow[];
  steps: StepRow[];
}> {
  const db = supabase();
  const [modulesRes, stepsRes] = await Promise.all([
    db
      .from("academy_modules")
      .select("id, title, kind, sort_order")
      .order("sort_order"),
    db
      .from("academy_steps")
      .select("id, module_id, step_no, title, prompt_text, step_type"),
  ]);
  if (modulesRes.error) {
    throw new Error(`Couldn't load academy modules: ${modulesRes.error.message}`);
  }
  if (stepsRes.error) {
    throw new Error(`Couldn't load academy steps: ${stepsRes.error.message}`);
  }
  const modules = (modulesRes.data ?? []) as ModuleRow[];
  if (modules.length === 0) {
    throw new Error(
      "The Academy isn't seeded yet. Apply migration 0005 and run `npm run seed:academy`.",
    );
  }
  const orderByModule = new Map(modules.map((m) => [m.id, m.sort_order]));
  const steps = ((stepsRes.data ?? []) as StepRow[]).sort(
    (a, b) =>
      (orderByModule.get(a.module_id) ?? 0) - (orderByModule.get(b.module_id) ?? 0) ||
      a.step_no - b.step_no,
  );
  return { modules, steps };
}

/** Resolve a module by partial, case-insensitive title (like resolveProject). */
function resolveModule(modules: ModuleRow[], name: string): ModuleRow {
  const needle = name.trim().toLowerCase();
  const exact = modules.filter((m) => m.title.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  const partial = modules.filter((m) => m.title.toLowerCase().includes(needle));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new Error(
      `"${name}" matches multiple modules: ${partial.map((m) => m.title).join("; ")}. ` +
        "Use a more specific name.",
    );
  }
  throw new Error(
    `No module matches "${name}". Modules: ${modules.map((m) => m.title).join("; ")}.`,
  );
}

async function loadMyDoneSet(actorId: string): Promise<Set<string>> {
  const { data, error } = await supabase()
    .from("academy_step_progress")
    .select("step_id")
    .eq("user_id", actorId);
  if (error) throw new Error(`Couldn't load your progress: ${error.message}`);
  return new Set((data ?? []).map((row: { step_id: string }) => row.step_id));
}

function stepHeading(
  mod: ModuleRow,
  step: StepRow,
  totalInModule: number,
): string {
  return (
    `## ${mod.title} — Step ${step.step_no}/${totalInModule}: ${step.title} ` +
    (STEP_TYPE_TAG[step.step_type] ?? "")
  );
}

export function registerAcademyTools(server: McpServer): void {
  server.registerTool(
    "brain_academy_next",
    {
      title: "Get your next Academy step",
      description:
        "Return the acting team member's next incomplete Sandbox Academy step(s), " +
        "with the full prompt ready to follow. Steps tagged [Chat] are meant for a chat " +
        "AI; [Coding Agent] steps are meant to be done right here. Optionally scope to " +
        "one module (partial name OK).",
      inputSchema: {
        module: z
          .string()
          .optional()
          .describe("Only look in this module (partial name OK)"),
        count: z
          .number()
          .int()
          .min(1)
          .max(5)
          .default(1)
          .describe("How many upcoming steps to return (default 1)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ module, count }) => {
      const actor = await getActor();
      const { modules, steps } = await loadCurriculum();
      const done = await loadMyDoneSet(actor.id);

      const scope = module ? resolveModule(modules, module) : null;
      const scopedSteps = scope
        ? steps.filter((s) => s.module_id === scope.id)
        : steps;
      const upcoming = scopedSteps.filter((s) => !done.has(s.id)).slice(0, count);

      const doneCount = scopedSteps.filter((s) => done.has(s.id)).length;
      const where = scope ? `**${scope.title}**` : "the curriculum";
      if (upcoming.length === 0) {
        return ok(
          `You've completed all ${scopedSteps.length} steps in ${where}. 🎓` +
            (scope ? " Try brain_academy_next without a module for what's next overall." : ""),
        );
      }

      const moduleById = new Map(modules.map((m) => [m.id, m]));
      const totalByModule = new Map<string, number>();
      for (const s of steps) {
        totalByModule.set(s.module_id, (totalByModule.get(s.module_id) ?? 0) + 1);
      }

      const blocks = upcoming.map((step) => {
        const mod = moduleById.get(step.module_id)!;
        return [
          stepHeading(mod, step, totalByModule.get(step.module_id) ?? 0),
          step.prompt_text,
        ].join("\n\n");
      });
      blocks.push(
        `_Progress in ${where}: ${doneCount}/${scopedSteps.length} steps done. ` +
          "When you finish, call brain_academy_complete (optionally with minutes worked " +
          "and what you learned)._",
      );
      return ok(blocks.join("\n\n---\n\n"));
    }),
  );

  server.registerTool(
    "brain_academy_complete",
    {
      title: "Mark an Academy step complete",
      description:
        "Mark a Sandbox Academy step done (or not done) for the acting team member. " +
        "Identify the step by module + step number, by fuzzy title, or leave everything " +
        "out to complete your next incomplete step. Optionally log the minutes it took " +
        "(against the shared 'Academy' project) and capture what you learned as a " +
        "decision in the Brain.",
      inputSchema: {
        module: z
          .string()
          .optional()
          .describe("Module the step is in (partial name OK)"),
        step: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Step number within the module"),
        title: z
          .string()
          .optional()
          .describe("Step title to fuzzy-match instead of module+number"),
        done: z
          .boolean()
          .default(true)
          .describe("false to un-complete a step you marked by mistake"),
        minutes: z
          .number()
          .int()
          .min(1)
          .max(24 * 60)
          .optional()
          .describe("Minutes it took — logs time on the 'Academy' project"),
        note: z
          .string()
          .max(2000)
          .optional()
          .describe("Short note stored with your progress"),
        decision: z
          .string()
          .optional()
          .describe("What you tried and learned — saved to the Brain as a decision"),
        outcome: z
          .enum(["worked", "failed", "mixed"])
          .default("worked")
          .describe("How the decision turned out (only used with decision)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ module, step, title, done, minutes, note, decision, outcome }) => {
      const actor = await getActor();
      const db = supabase();
      const { modules, steps } = await loadCurriculum();
      const doneSet = await loadMyDoneSet(actor.id);
      const moduleById = new Map(modules.map((m) => [m.id, m]));

      // Resolve the step: title fuzzy > module+number > next incomplete.
      let target: StepRow | null = null;
      if (title?.trim()) {
        const needle = title.trim().toLowerCase();
        const pool = module
          ? steps.filter((s) => s.module_id === resolveModule(modules, module).id)
          : steps;
        const exact = pool.filter((s) => s.title.toLowerCase() === needle);
        const matches =
          exact.length > 0
            ? exact
            : pool.filter((s) => s.title.toLowerCase().includes(needle));
        if (matches.length === 0) return fail(`No step matches "${title}".`);
        if (matches.length > 1) {
          return fail(
            `"${title}" matches multiple steps: ${matches
              .slice(0, 6)
              .map(
                (s) =>
                  `${moduleById.get(s.module_id)?.title ?? "?"} step ${s.step_no} (${s.title})`,
              )
              .join("; ")}. Be more specific, or pass module + step number.`,
          );
        }
        target = matches[0];
      } else if (step != null) {
        if (!module) {
          return fail("Pass the module name along with the step number.");
        }
        const mod = resolveModule(modules, module);
        target =
          steps.find((s) => s.module_id === mod.id && s.step_no === step) ?? null;
        if (!target) {
          return fail(`${mod.title} has no step ${step}.`);
        }
      } else {
        target = steps.find((s) => !doneSet.has(s.id)) ?? null;
        if (!target) {
          return ok("Nothing left to complete — you've finished the whole Academy. 🎓");
        }
      }

      const mod = moduleById.get(target.module_id)!;
      const label = `**${mod.title}** step ${target.step_no}: ${target.title}`;
      const lines: string[] = [];

      if (done) {
        const { error } = await db.from("academy_step_progress").upsert(
          {
            user_id: actor.id,
            step_id: target.id,
            notes: note?.trim() || null,
          },
          { onConflict: "user_id,step_id" },
        );
        if (error) return fail(error.message);
        await emitMcpEvent({
          verb: "completed",
          object: { type: "academy_module", id: mod.id, label: mod.title },
          metadata: { step_id: target.id, step_no: target.step_no },
        });
        lines.push(`Completed ${label}.`);
      } else {
        const { error } = await db
          .from("academy_step_progress")
          .delete()
          .eq("user_id", actor.id)
          .eq("step_id", target.id);
        if (error) return fail(error.message);
        lines.push(`Reopened ${label}.`);
      }

      // Optional: log the time on the shared "Academy" project (create it once).
      if (done && minutes) {
        let { data: proj } = await db
          .from("projects")
          .select("id, name")
          .ilike("name", "Academy")
          .maybeSingle();
        if (!proj) {
          const { data: created, error: createError } = await db
            .from("projects")
            .insert({
              name: "Academy",
              description: "Sandbox Academy curriculum work",
              status: "active",
              created_by: actor.id,
            })
            .select("id, name")
            .single();
          if (createError) return fail(createError.message);
          proj = created;
        }
        const endedAt = new Date();
        const startedAt = new Date(endedAt.getTime() - minutes * 60_000);
        const { error: timeError } = await db.from("time_entries").insert({
          user_id: actor.id,
          project_id: proj.id,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          notes: `Academy: ${mod.title} — step ${target.step_no} (${target.title})`,
          source: "manual",
        });
        if (timeError) return fail(timeError.message);
        lines.push(`Logged **${formatDuration(minutes * 60_000)}** on **${proj.name}**.`);
      }

      // Optional: capture the learning as a decision in the Brain.
      if (done && decision?.trim()) {
        const { error: decisionError } = await db.from("knowledge_items").insert({
          kind: "decision",
          title: `Academy: ${target.title}`,
          description: `${mod.title} — step ${target.step_no}`,
          content: decision.trim(),
          data: { outcome },
          created_by: actor.id,
        });
        if (decisionError) return fail(decisionError.message);
        lines.push(`Saved the learning to the Brain (decision, ${outcome}).`);
      }

      // Progress + teaser for what's next.
      const moduleSteps = steps.filter((s) => s.module_id === mod.id);
      const doneNow = done
        ? new Set([...doneSet, target.id])
        : new Set([...doneSet].filter((id) => id !== target.id));
      const moduleDone = moduleSteps.filter((s) => doneNow.has(s.id)).length;
      lines.push(
        `Module progress: ${moduleDone}/${moduleSteps.length} · ` +
          `overall ${[...doneNow].length}/${steps.length}.`,
      );
      const next = steps.find((s) => !doneNow.has(s.id));
      if (next) {
        const nextMod = moduleById.get(next.module_id)!;
        lines.push(
          `Next up: ${nextMod.title} — step ${next.step_no}: ${next.title} ` +
            `${STEP_TYPE_TAG[next.step_type] ?? ""}`,
        );
      }
      return ok(lines.join("\n\n"));
    }),
  );

  server.registerTool(
    "brain_academy_progress",
    {
      title: "Academy progress report",
      description:
        "How far the team (or just you) is through the Sandbox Academy: per-module " +
        "completion per person, plus the Learning Outcomes scoreboard (coverage, " +
        "average level, confidence, and per-outcome ratings).",
      inputSchema: {
        scope: z
          .enum(["me", "team"])
          .default("team")
          .describe("'me' for just your numbers"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ scope }) => {
      const actor = await getActor();
      const db = supabase();
      const { modules, steps } = await loadCurriculum();

      const [progressRes, profilesRes, outcomesRes, assessmentsRes, mappingRes] =
        await Promise.all([
          db.from("academy_step_progress").select("user_id, step_id"),
          db.from("profiles").select("id, full_name, email"),
          db.from("academy_outcomes").select("id, name, sort_order").order("sort_order"),
          db
            .from("academy_outcome_assessments")
            .select("user_id, outcome_id, rating, confidence"),
          db.from("academy_module_outcomes").select("module_id, outcome_id"),
        ]);
      if (progressRes.error) return fail(progressRes.error.message);

      const profiles = (profilesRes.data ?? []).filter(
        (p) => scope === "team" || p.id === actor.id,
      );
      const personLabel = (id: string) => {
        const p = (profilesRes.data ?? []).find((row) => row.id === id);
        const base = p?.full_name ?? p?.email ?? "Unknown";
        return id === actor.id ? `${base} (you)` : base;
      };

      const doneByUser = new Map<string, Set<string>>();
      for (const row of progressRes.data ?? []) {
        const set = doneByUser.get(row.user_id) ?? new Set<string>();
        set.add(row.step_id);
        doneByUser.set(row.user_id, set);
      }

      const lines: string[] = ["# Academy progress", ""];

      lines.push("## Modules");
      for (const mod of modules) {
        const moduleSteps = steps.filter((s) => s.module_id === mod.id);
        const perPerson = profiles
          .map((p) => {
            const set = doneByUser.get(p.id);
            const count = set
              ? moduleSteps.filter((s) => set.has(s.id)).length
              : 0;
            return `${personLabel(p.id)} ${count}/${moduleSteps.length}`;
          })
          .join(" · ");
        lines.push(`- ${mod.title}: ${perPerson}`);
      }
      lines.push("");

      const totalSteps = steps.length;
      lines.push("## Totals");
      for (const p of profiles) {
        const count = doneByUser.get(p.id)?.size ?? 0;
        const pct = totalSteps > 0 ? Math.round((count / totalSteps) * 100) : 0;
        lines.push(`- ${personLabel(p.id)}: ${count}/${totalSteps} steps (${pct}%)`);
      }
      lines.push("");

      const outcomes = outcomesRes.data ?? [];
      const assessments = assessmentsRes.data ?? [];
      const mapping = mappingRes.data ?? [];
      if (outcomes.length > 0) {
        lines.push("## Learning outcomes");
        for (const p of profiles) {
          const mine = assessments.filter((a) => a.user_id === p.id);
          const avg =
            mine.length > 0
              ? mine.reduce((sum, a) => sum + a.rating, 0) / mine.length
              : null;
          const confidences = mine
            .map((a) => a.confidence)
            .filter((c): c is number => c != null);
          const avgConf =
            confidences.length > 0
              ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
              : null;
          lines.push(
            `- ${personLabel(p.id)}: rated ${mine.length}/${outcomes.length}` +
              (avg != null
                ? ` · avg ${avg.toFixed(1)} (≈ ${TIER_LABELS[Math.min(3, Math.round(avg) - 1)]})`
                : "") +
              (avgConf != null ? ` · confidence ${avgConf.toFixed(1)}/5` : ""),
          );
        }
        lines.push("");

        const myDone = doneByUser.get(actor.id) ?? new Set<string>();
        for (const outcome of outcomes) {
          const mappedModules = mapping
            .filter((m) => m.outcome_id === outcome.id)
            .map((m) => m.module_id);
          const mappedSteps = steps.filter((s) =>
            mappedModules.includes(s.module_id),
          );
          const trained =
            mappedSteps.length > 0
              ? Math.round(
                  (mappedSteps.filter((s) => myDone.has(s.id)).length /
                    mappedSteps.length) *
                    100,
                )
              : 0;
          const ratings = profiles
            .map((p) => {
              const a = assessments.find(
                (row) => row.user_id === p.id && row.outcome_id === outcome.id,
              );
              return `${personLabel(p.id).split(" ")[0]}: ${
                a ? TIER_LABELS[a.rating - 1] : "—"
              }`;
            })
            .join(", ");
          lines.push(`- ${outcome.name} — trained ${trained}% · ${ratings}`);
        }
      }

      return ok(lines.join("\n"));
    }),
  );

  server.registerTool(
    "brain_rate_outcome",
    {
      title: "Rate yourself on a learning outcome",
      description:
        "Save (or update) the acting team member's self-assessment for one of the " +
        "founder Learning Outcomes. Rating is a tier — 1 Novice, 2 Developing, " +
        "3 Strong, 4 Advanced — given as the number or the word.",
      inputSchema: {
        outcome: z
          .string()
          .min(1)
          .describe("Outcome name (partial match OK, e.g. 'security')"),
        rating: z
          .union([
            z.number().int().min(1).max(4),
            z.enum(["novice", "developing", "strong", "advanced"]),
          ])
          .describe("1–4 or novice/developing/strong/advanced"),
        confidence: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("How sure you are, 1–5 (optional)"),
        note: z
          .string()
          .max(2000)
          .optional()
          .describe("Evidence or what to practice next (optional)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ outcome, rating, confidence, note }) => {
      const actor = await getActor();
      const db = supabase();

      const { data: outcomes, error } = await db
        .from("academy_outcomes")
        .select("id, name");
      if (error) return fail(`Couldn't load outcomes: ${error.message}`);
      if (!outcomes || outcomes.length === 0) {
        return fail(
          "No learning outcomes exist yet. Apply migration 0005 and run `npm run seed:academy`.",
        );
      }

      const needle = outcome.trim().toLowerCase();
      const exact = outcomes.filter((o) => o.name.toLowerCase() === needle);
      const matches =
        exact.length > 0
          ? exact
          : outcomes.filter((o) => o.name.toLowerCase().includes(needle));
      if (matches.length === 0) {
        return fail(
          `No outcome matches "${outcome}". Outcomes: ${outcomes
            .map((o) => o.name)
            .join("; ")}.`,
        );
      }
      if (matches.length > 1) {
        return fail(
          `"${outcome}" matches multiple outcomes: ${matches
            .map((o) => o.name)
            .join("; ")}. Be more specific.`,
        );
      }

      const numericRating =
        typeof rating === "number" ? rating : TIER_BY_WORD[rating];
      const { error: upsertError } = await db
        .from("academy_outcome_assessments")
        .upsert(
          {
            user_id: actor.id,
            outcome_id: matches[0].id,
            rating: numericRating,
            confidence: confidence ?? null,
            note: note?.trim() || null,
          },
          { onConflict: "user_id,outcome_id" },
        );
      if (upsertError) return fail(upsertError.message);

      await emitMcpEvent({
        verb: "rated",
        object: {
          type: "academy_outcome",
          id: matches[0].id,
          label: matches[0].name,
        },
        metadata: { rating: numericRating },
      });
      return ok(
        `Rated **${matches[0].name}** as **${TIER_LABELS[numericRating - 1]}**` +
          (confidence != null ? ` (confidence ${confidence}/5)` : "") +
          ".",
      );
    }),
  );
}
