# Graphify × Sandbox Brain — 3 ways to make it a product feature

## Context

**The ask:** not "use Graphify to help us build this app," but "bake Graphify *into* Sandbox Brain as a feature" — an additional storage/retrieval source for fast, token-cheap lookups and relational-graph help, so the app grows from a team hub into a **software-developer OS brain** that connects teammates around their actual code.

**What Graphify is** (grounds every idea below): an MIT-licensed, local-first tool that parses a folder of code + docs + multimodal into a queryable knowledge graph (`graph.json`, NetworkX) using tree-sitter ASTs (deterministic, offline) plus an optional LLM semantic pass. It ships a **CLI**, a **Python library**, and an **MCP server** (`python -m graphify.serve graph.json`, stdio or HTTP-with-API-key) exposing `query_graph`, `get_node`, `get_neighbors`, `shortest_path`, `list_prs`, `get_pr_impact`. Nodes = functions/classes/modules, docs, code comments (`NOTE:`/`WHY:`/`HACK:`), concepts, and Leiden-detected "communities" (subsystems). Edges = `calls`/`imports`/`inherits`/`uses`/`references`/`depends_on`, each tagged `EXTRACTED` or `INFERRED`. Headline number: ~1.7k tokens to answer a question against the graph vs ~123k reading raw files — a **71× reduction**. `merge-graphs` unifies multiple repos.

**Why it fits Sandbox Brain specifically:** the app already has (a) a `project_archive` knowledge kind that stores **zipped repos** in Supabase Storage, (b) a polymorphic `links` graph table + a `react-force-graph-2d` graph view that already renders notes/people/ideas as one web, (c) a `tasks` table with an `area` field, (d) saved `agents`, and (e) an `academy`. It is missing exactly what Graphify provides: any structured understanding of the *code itself*. Today search is Postgres full-text only (`tsvector`) — great for prose, blind to call graphs.

**Architectural constraint to respect:** Graphify is Python; Sandbox Brain is Node/Next 16 on Vercel free-tier + Supabase. Vercel can't host a long-running Python process. So the pattern for all three ideas is the same: **graph-building is an offline/CI/local job** that writes `graph.json` into Supabase Storage (next to the existing archive zips); **querying** happens either by (a) standing up one small hosted Graphify **HTTP MCP** per team (API-key'd) that the Node MCP server + app proxy to, or (b) loading `graph.json` and traversing it in Node. Start with (a) — it reuses Graphify's query logic for free.

---

## Idea 1 — "Code-aware Brain": Graphify as a retrieval backend for the Brain (fast lookups + token saving)

**The pitch.** Every project already can hold a `project_archive` (a zipped repo) in the Brain. When one is uploaded — or a project is pointed at a git URL — kick off a Graphify build and store the resulting `graph.json` in Storage, tracked by a new `code_graphs` row (project_id, storage_path, commit_sha, built_at, community summary). Then expose the graph through the **existing sandbox-brain MCP server** as three new tools that proxy to Graphify: `brain_code_query`, `brain_code_impact` (`get_pr_impact`), `brain_code_path` (`shortest_path`). Optionally a Brain UI tab: "Ask this codebase."

**Why it's compelling.** This is the user's stated goal made literal — an *additional storage source for fast lookups and token saving*. Instead of an agent (or a teammate's Claude session) reading raw files to answer "how does auth flow through project X," it asks the graph for ~1.7k tokens. Because the graph lives server-side and is shared, the whole 3-person team queries **one** canonical, always-current map — nobody re-indexes locally, and answers are consistent across people and across AI agents.

**Touch points:** `mcp/src/tools/` (new `code.ts` alongside `knowledge.ts`/`search.ts`), `mcp/src/index.ts` (register tools), a `0008_code_graphs.sql` migration, the Storage bucket from `0002_storage.sql`, the Brain page. Fold `brain_code_query` into `brain_search` (`mcp/src/tools/search.ts`) so cross-hub search gains a code lane.

---

## Idea 2 — "One super-graph": stitch code entities into Sandbox Brain's existing relational graph

**The pitch.** Sandbox Brain's `links` table is already polymorphic and its graph view already fuses notes ↔ people ↔ ideas ↔ tasks. Add `code_entity` (and maybe `code_community`) as new link entity-types, import Graphify's nodes/edges, and — the valuable part — **stitch code to the human artifacts that surround it**:
- a decision note (`knowledge_items.kind='decision'`) → `affects` → the module it governs
- a `task` (which already has an `area`) → `touches` → the code community for that area
- a `prompt` that generated code → `produced` → the resulting module
- a `profile` (person) → `owns`/`last-touched` → a subsystem (from `list_prs`)

**Why it's compelling.** This is the "OS brain that connects teams" idea. You get traversal no other tool offers: *person → decision → code → open task* in one navigable web. "Who understands the billing subsystem, what decisions shaped it, and what's still open against it?" becomes a graph walk, rendered in the force-graph view they already built. Graphify's Leiden **communities** give you human-readable subsystem clusters to anchor this on; `merge-graphs` extends it across all the team's projects at once.

**Touch points:** a migration widening the `links`/`taggables` entity-type CHECK constraints (same pattern every migration 0004–0007 already uses); `mcp/src/helpers.ts` (the `syncWikiLinks()` materialization logic is the model to copy for a `syncCodeLinks()`); `src/app/graph/page.tsx` + `src/components/graph/` (add code node/edge rendering, a filter toggle so the code layer can be shown/hidden).

---

## Idea 3 — "Auto-onboarding + grounded Agents": turn the code graph into people-connecting features

**The pitch.** Two connected surfaces the app already has, powered by the graph:
1. **Academy auto-tour.** Graphify's community detection labels a repo's subsystems for free. Generate an Academy module per project — one step per community — as a guided "map of this codebase" a new teammate walks through, each step deep-linking into the super-graph (Idea 2). Tribal architecture knowledge becomes structured onboarding.
2. **Graph-grounded Agents.** Saved `agents` get the team's Graphify HTTP MCP wired in as a retrieval tool, so an agent answering "add a feature to project X" grounds itself on the real architecture at ~1.7k tokens instead of guessing or ingesting the repo. Pair with `get_pr_impact`: when a `task` moves to `done`, auto-write a "blast radius" note listing the modules/communities the change rippled through, and link it (Idea 2 wiring).

**Why it's compelling.** This is the "connect developers more efficiently" half. A 3-person team's biggest cost is context transfer; this makes the codebase *self-explaining* to both humans (Academy tour) and their AI agents (grounded retrieval), and turns every completed task into a durable, linked record of what actually changed.

**Touch points:** `mcp/src/tools/academy.ts` + `0005_academy.sql` (module/step generation); `agents` table + `0004_agents.sql` (`tools[]` array already exists — add the graph MCP as a selectable tool); `mcp/src/tools/` for the task→note "blast radius" automation.

---

## How the three relate

They're a stack, not alternatives: **Idea 1** is the foundation (get a queryable graph into the app and reachable via MCP). **Idea 2** makes it *relational* by fusing it with the human knowledge web. **Idea 3** turns that fused graph into features that connect people. Ship 1 → 2 → 3.

## Open questions before any build

- Is this a real feature to build now, or a concept/vision doc to think with? (Changes whether the next step is a spec or nothing.)
- If building: which idea first? (Recommend Idea 1 as the MVP — smallest, and everything else depends on it.)
- How does code get in — keep leaning on the `project_archive` zip upload, or add a "link a git repo" flow?
- Willing to run one small hosted Graphify HTTP-MCP service (a cheap always-on box / Fly.io / Render), given Vercel can't host the Python? Or should graph-building stay a manual local/CI step for now?

## Verification (once an MVP is chosen)

For Idea 1 MVP: build a `graph.json` locally with `graphify extract` on this very repo, drop it in Storage, add the `code.ts` MCP tools, then from an interactive Claude session call `brain_code_query "how does the sandbox-brain MCP authenticate?"` and confirm it answers from the graph (and cheaply) versus `brain_search`. Compare token cost of the two.

## Sources

- [graphify.net](https://graphify.net/)
- [Graphify on GitHub](https://github.com/safishamsi/graphify)
- [Augment Code — Graphify writeup](https://www.augmentcode.com/learn/graphify-knowledge-graph-codebase-skill)
