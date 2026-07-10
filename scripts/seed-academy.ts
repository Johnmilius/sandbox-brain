/**
 * Seed the Academy tables from docs/sandbox_academy_export.txt.
 *
 *   npm run seed:academy
 *
 * Idempotent: modules upsert on slug, steps on (module_id, step_no), outcomes
 * on slug, module->outcome mappings on their primary key. Re-running after a
 * curriculum edit updates prompt text in place; nothing is ever deleted.
 *
 * Auth (mirrors mcp/src/context.ts): prefers SUPABASE_SERVICE_ROLE_KEY, falls
 * back to BRAIN_USER_REFRESH_TOKEN + anon key. Reads .env.local for both.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const EXPORT_PATH = join(REPO_ROOT, "docs", "sandbox_academy_export.txt");

// ---------------------------------------------------------------------------
// Env (minimal .env.local parser, same shape as mcp/src/context.ts)
// ---------------------------------------------------------------------------

function loadEnvFileFallback(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const text = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local — rely on process.env
  }
  return result;
}

const fileEnv = loadEnvFileFallback();

function env(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name] ?? fileEnv[name];
    if (value) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The 20 Learning Outcomes (the export's section is an unusable DOM dump, so
// they are pinned here — names exactly as they appear in the Academy app).
// ---------------------------------------------------------------------------

const OUTCOMES: { slug: string; name: string }[] = [
  { slug: "business-model-pricing", name: "Business Model & Pricing" },
  { slug: "core-coding-proficiency", name: "Core Coding Proficiency & Code Quality" },
  { slug: "customer-problem-understanding", name: "Customer & Problem Understanding" },
  { slug: "data-architecture-analytics", name: "Data Architecture & Analytics" },
  { slug: "engineering-process-collaboration", name: "Engineering Process & Collaboration" },
  { slug: "fundraising-investor-management", name: "Fundraising & Investor Management" },
  { slug: "go-to-market-growth", name: "Go-to-Market Strategy & Growth Experimentation" },
  { slug: "hiring-culture-people", name: "Hiring, Culture & People Management" },
  { slug: "infrastructure-devops-deployment", name: "Infrastructure, DevOps & Deployment" },
  { slug: "technical-debt-iteration-speed", name: "Managing Technical Debt & Iteration Speed" },
  { slug: "market-opportunity-sizing", name: "Market & Opportunity Sizing" },
  { slug: "metrics-analytics-financial-literacy", name: "Metrics, Analytics & Financial Literacy" },
  { slug: "operational-execution-prioritization", name: "Operational Execution & Prioritization" },
  { slug: "positioning-story-narrative", name: "Positioning, Story & Narrative" },
  { slug: "product-user-centric-thinking", name: "Product & User-Centric Technical Thinking" },
  { slug: "sales-deal-execution", name: "Sales & Deal Execution" },
  { slug: "security-privacy-reliability", name: "Security, Privacy & Reliability (Early Stage)" },
  { slug: "system-design-architecture", name: "System Design & Architecture (0→1)" },
  { slug: "technical-hiring-mentoring", name: "Technical Hiring & Mentoring" },
  { slug: "technical-roadmapping-tradeoffs", name: "Technical Roadmapping & Tradeoff Management" },
];

/** Which competencies each module trains, keyed by module sort_order. */
const PMF_OUTCOMES = [
  "customer-problem-understanding",
  "positioning-story-narrative",
  "go-to-market-growth",
  "market-opportunity-sizing",
  "sales-deal-execution",
];

const MODULE_OUTCOMES: Record<number, string[]> = {
  1: ["core-coding-proficiency", "infrastructure-devops-deployment", "engineering-process-collaboration"],
  2: ["core-coding-proficiency", "product-user-centric-thinking"],
  3: ["system-design-architecture", "security-privacy-reliability", "core-coding-proficiency"],
  4: ["data-architecture-analytics", "system-design-architecture"],
  5: ["security-privacy-reliability", "data-architecture-analytics"],
  6: ["business-model-pricing", "operational-execution-prioritization", "security-privacy-reliability"],
  7: ["product-user-centric-thinking", "technical-roadmapping-tradeoffs", "system-design-architecture"],
  8: PMF_OUTCOMES,
  9: PMF_OUTCOMES,
  10: PMF_OUTCOMES,
  11: PMF_OUTCOMES,
  12: PMF_OUTCOMES,
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

type ParsedStep = {
  step_no: number;
  title: string;
  prompt_text: string;
  step_type: "chat" | "coding_agent" | "video";
};

type ParsedModule = {
  slug: string;
  title: string;
  description: string | null;
  kind: "course" | "workshop";
  sort_order: number;
  steps: ParsedStep[];
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STEP_HEADING = /^## Step (\d+): (.+) \[(Chat|Coding Agent)\]$/gm;

function parseExport(text: string): ParsedModule[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/^---\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean);

  const modules: ParsedModule[] = [];
  for (const block of blocks) {
    const titleMatch = block.match(/^# (.+)$/m);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // The Learning Outcomes block is a DOM dump; outcomes are pinned above.
    if (title === "Learning Outcomes") continue;

    if (title.startsWith("Product-Market Fit Workshop")) {
      modules.push({
        slug: slugify(title),
        title,
        description: "Video workshop session — watch together, then log takeaways as a note.",
        kind: "workshop",
        sort_order: modules.length + 1,
        steps: [
          {
            step_no: 1,
            title: `Watch: ${title.replace(/^Product-Market Fit Workshop:\s*/, "")}`,
            prompt_text: "(Video session — watch together, then log takeaways as a note.)",
            step_type: "video",
          },
        ],
      });
      continue;
    }

    // Course module: description is the "N steps — copy each prompt…" line.
    const descriptionMatch = block.match(/^\d+ steps — .+$/m);
    const headings = [...block.matchAll(STEP_HEADING)];
    const steps: ParsedStep[] = headings.map((match, i) => {
      const start = match.index! + match[0].length;
      const end = i + 1 < headings.length ? headings[i + 1].index! : block.length;
      return {
        step_no: Number(match[1]),
        title: match[2].trim(),
        prompt_text: block.slice(start, end).trim(),
        step_type: match[3] === "Coding Agent" ? "coding_agent" : "chat",
      };
    });

    modules.push({
      slug: slugify(title),
      title,
      description: descriptionMatch?.[0] ?? null,
      kind: "course",
      sort_order: modules.length + 1,
      steps,
    });
  }
  return modules;
}

// ---------------------------------------------------------------------------
// Auth + writes
// ---------------------------------------------------------------------------

async function createSeedClient(): Promise<SupabaseClient> {
  const url = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  if (!url) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");

  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const anonKey = env("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const refreshToken = env("BRAIN_USER_REFRESH_TOKEN");
  if (!anonKey || !refreshToken) {
    throw new Error(
      "Need SUPABASE_SERVICE_ROLE_KEY, or BRAIN_USER_REFRESH_TOKEN + anon key, in .env.local.",
    );
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error || !data.session) {
    throw new Error(
      `Couldn't sign in with BRAIN_USER_REFRESH_TOKEN: ${error?.message ?? "no session"}. ` +
        "Grab a fresh token from the web app (Profile -> MCP access).",
    );
  }
  return client;
}

async function main(): Promise<void> {
  const text = readFileSync(EXPORT_PATH, "utf8");
  const modules = parseExport(text);
  const totalSteps = modules.reduce((sum, m) => sum + m.steps.length, 0);
  console.log(
    `Parsed ${modules.length} modules, ${totalSteps} steps ` +
      `(${modules.filter((m) => m.kind === "course").length} courses, ` +
      `${modules.filter((m) => m.kind === "workshop").length} workshops).`,
  );

  const supabase = await createSeedClient();

  // Modules ---------------------------------------------------------------
  const { error: moduleError } = await supabase.from("academy_modules").upsert(
    modules.map(({ slug, title, description, kind, sort_order }) => ({
      slug,
      title,
      description,
      kind,
      sort_order,
    })),
    { onConflict: "slug" },
  );
  if (moduleError) throw new Error(`Modules upsert failed: ${moduleError.message}`);

  const { data: moduleRows, error: moduleReadError } = await supabase
    .from("academy_modules")
    .select("id, slug, sort_order");
  if (moduleReadError || !moduleRows) {
    throw new Error(`Couldn't read modules back: ${moduleReadError?.message}`);
  }
  const moduleIdBySlug = new Map(moduleRows.map((row) => [row.slug, row.id]));

  // Steps -----------------------------------------------------------------
  const stepRows = modules.flatMap((mod) =>
    mod.steps.map((step) => ({
      module_id: moduleIdBySlug.get(mod.slug)!,
      step_no: step.step_no,
      title: step.title,
      prompt_text: step.prompt_text,
      step_type: step.step_type,
    })),
  );
  const { error: stepError } = await supabase
    .from("academy_steps")
    .upsert(stepRows, { onConflict: "module_id,step_no" });
  if (stepError) throw new Error(`Steps upsert failed: ${stepError.message}`);

  // Outcomes ----------------------------------------------------------------
  const { error: outcomeError } = await supabase.from("academy_outcomes").upsert(
    OUTCOMES.map((outcome, i) => ({ ...outcome, sort_order: i + 1 })),
    { onConflict: "slug" },
  );
  if (outcomeError) throw new Error(`Outcomes upsert failed: ${outcomeError.message}`);

  const { data: outcomeRows, error: outcomeReadError } = await supabase
    .from("academy_outcomes")
    .select("id, slug");
  if (outcomeReadError || !outcomeRows) {
    throw new Error(`Couldn't read outcomes back: ${outcomeReadError?.message}`);
  }
  const outcomeIdBySlug = new Map(outcomeRows.map((row) => [row.slug, row.id]));

  // Module -> outcome mapping ------------------------------------------------
  const mappingRows = modules.flatMap((mod) =>
    (MODULE_OUTCOMES[mod.sort_order] ?? []).map((slug) => {
      const outcomeId = outcomeIdBySlug.get(slug);
      if (!outcomeId) throw new Error(`Unknown outcome slug in mapping: ${slug}`);
      return { module_id: moduleIdBySlug.get(mod.slug)!, outcome_id: outcomeId };
    }),
  );
  const { error: mappingError } = await supabase
    .from("academy_module_outcomes")
    .upsert(mappingRows, { onConflict: "module_id,outcome_id", ignoreDuplicates: true });
  if (mappingError) throw new Error(`Module-outcome upsert failed: ${mappingError.message}`);

  console.log(
    `Seeded ${modules.length} modules, ${stepRows.length} steps, ` +
      `${OUTCOMES.length} outcomes, ${mappingRows.length} module-outcome mappings.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
