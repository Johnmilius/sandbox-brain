# The Brain — Roadmap: from team hub to Organizational Intelligence OS

This document converges the three vision docs in this folder —
[OS_for_Orginizational_Intelligence.md](OS_for_Orginizational_Intelligence.md),
[scalability.md](scalability.md), and
[graphify-integration-ideas.md](graphify-integration-ideas.md) — into one
architecture and one sequenced build plan. The scalability doc is the skeleton:
each pillar becomes an enforced mechanism with acceptance criteria, not a slogan.

Constraints we hold ourselves to (from the vision docs): Sandbox starts soon,
V1 must be something the team opens daily, and features follow *real pain*
(observation-driven development) — the later phases here are a menu, not a promise.

---

## Part 1 — The six primitives

Everything in all three docs reduces to six primitives. Every phase below
builds or feeds one.

1. **Objects** — every knowledge type addressed one way: `(object_type, object_id)`.
   Schema stays table-per-type (no rewrite); unity comes from a contract, not a
   mega-table.
2. **Typed links** — relationships carry meaning (`implements`, `blocks`,
   `affects`, `decided_in`, …). The polymorphic `links` table is the substrate;
   it's semantically thin today (`'wiki'` + tags).
3. **Events** — an append-only log of everything that happens. The
   organizational timeline is *derived* from it, never hand-maintained.
4. **Retrieval providers** — fulltext (exists), pgvector (specced in
   `docs/ai-readiness.md`), Graphify code graphs — all behind one search
   interface. Callers never know which provider answered.
5. **MCP as the model-agnostic door** — the Brain owns memory; Claude/ChatGPT/
   Cursor merely reason over it. Every app capability must also land as a
   `brain_*` tool. AI-written facts are `suggested` until a human confirms.
6. **Connectors** — external knowledge (GitHub, AI sessions, meetings, Slack)
   arrives as `fetch → map to objects/links/events → upsert → emit`. One
   template, many sources.

---

## Part 2 — Scalability architecture, pillar by pillar

### Pillar 1 — Data scalability: "a new type is a row, not a redesign"

**Where the old schema broke:** adding any entity type required `ALTER`-ing the
CHECK constraints on `links` *and* `taggables` (the 0004–0007 migration
pattern) — DDL on two shared, load-bearing tables per new type.

**Mechanisms:**
- **Type registry table** (`object_types`) — `links.source_type/target_type`
  and `taggables.entity_type` are FKs to it. Registering a new type =
  **INSERT one row**, not ALTER on shared tables.
- **`objects` view** — unions each content table's
  `(object_type, object_id, title, created_by, created_at)`. Search-all, graph,
  and timeline consume the view; new types join by adding one UNION arm.
- **Standard content-table contract** (every future table): `id uuid pk`,
  `created_by`, `created_at`/`updated_at`, generated `search_document tsvector`
  + GIN index, RLS via shared policy functions, jsonb as the escape valve —
  new *fields* start in jsonb and get promoted to columns only when
  queried/indexed. Additive-only migrations.
- **The new-object-type playbook** — see `docs/playbook-new-object-type.md`.
  Links, tags, search, graph, and timeline pick a new type up automatically.

**Acceptance test:** adding a throwaway `meetings` type end-to-end (linkable,
taggable, searchable, on the graph and timeline) takes ≤ 1 hour and touches
≤ 6 files.

### Pillar 2 — Team scalability: "the system gets easier to understand as people join"

**Where it broke:** core logic duplicated across packages (wiki-link handling
existed in three places); permissions are a single hardcoded allowlist; the
home page showed everything to everyone.

**Mechanisms:**
- **Shared core package** — npm workspaces with `packages/core` holding the
  object contract, relationship vocabulary, event types + `emitEvent`, and
  wiki-link logic — consumed by both the Next app and the MCP server.
- **Permission seam, not permission system** — every RLS policy delegates to a
  small set of SECURITY DEFINER functions (`is_team_member()` today). When
  project membership/roles arrive (Stage B), only function bodies change;
  zero policies are rewritten. New tables must never inline auth logic.
- **Personalized surfaces** — the activity feed defaults to "my projects" with
  a toggle to "everything"; per-object History panels keep context local.
- **Self-explaining system** — decision records
  (`knowledge_items.kind='decision'`) become the team habit; the Academy
  auto-tour (Phase 6) turns each codebase into a guided walkthrough. A new
  developer asks the Brain "why is X built this way," not a teammate.
- **Conventions written down** — `docs/conventions.md` so contributor #4
  onboards from the repo itself.

**Acceptance test:** one logic change to wiki-link parsing lands in exactly one
file. A new teammate can create + link + find an object guided only by repo docs.

### Pillar 3 — System scalability: "every capability is a module with a seam"

**Where it breaks:** search is hardwired to `tsvector` in its callers; the
graph page loads every entity in the database; there is no async execution
surface (everything is request/response).

**Mechanisms — the four seams:**
- **`SearchProvider` interface** — `search(query, opts) → ScoredRef[]`;
  implementations `fulltext` / `vector` / `codegraph` behind a composer.
  Adding a retrieval technology = adding a module + a config flag.
- **`Connector` interface** — `pull(since) → {objects, links, events}` + an
  idempotent upsert runner (external-id dedup). GitHub is the reference
  implementation; connector #2 touches zero shared code.
- **Events table as the async seam (outbox)** — `events.processed_at` lets
  future workers consume unprocessed events (embedding-on-write,
  notifications, blast-radius notes) with no new infrastructure and no
  dual-write problem.
- **Graph as a service, not a page** — a `get_neighborhood(type, id, depth)`
  RPC returning a bounded subgraph; the graph renders neighborhoods and
  expands on demand. Also what makes a future graph DB swappable.
- **Provider abstraction for AI** — server-side model calls go through
  `AIProvider`/`EmbeddingProvider` interfaces with the model recorded on
  outputs (per `docs/ai-readiness.md`).

**Acceptance test:** disable a search provider by flag — search still works.
Feed and neighborhood queries are index-backed and keyset-paginated. A
connector re-run produces zero duplicates.

### Pillar 4 — Organizational scalability: "knowledge compounds instead of decays"

This pillar is a *loop*, not a schema feature: capture → connect → resurface →
observe gaps → improve capture.

**Mechanisms:**
- **Capture the why at the moment of decision** — decision-record template;
  blast-radius notes on task completion capture *what changed* with no effort.
- **Resurface via timeline + connections** — `brain_timeline` reconstructs the
  story of any project; backlinks panels on every object; the graph walk
  *person → decision → code → open task*.
- **Instrument the gaps** — log every search with its result count
  (`search_queries`); zero-result searches are literal unmet knowledge demand,
  reviewed weekly. A Brain-health panel: events/week by source, % of done
  tasks linked to any reasoning, orphan objects.
- **The weekly friction ritual** — a recurring review creating `ideas` tagged
  `friction`; Phases 3–6 are gated on these.
- **Exit-proofing** — append-only events + no-delete MCP design mean departing
  people leave their reasoning behind.
- **Compounding across startups** — every finished project archives into the
  Brain: repo zip + Graphify `graph.json` + decisions + retro note, all linked.

**Acceptance test:** for any completed project, `brain_timeline` reconstructs
its story in one call. Zero-result searches from week N appear as review items
in week N+1.

---

## Part 3 — Phased build plan

Ordered so later phases only ever add modules. Phases marked *friction-gated*
start only when the weekly review demands them.

| Phase | What ships | Pillars |
|---|---|---|
| **0 — Contracts** | `object_types` registry + `objects` view (migration 0008); npm workspaces + `packages/core` (object contract, wiki-links, event types); graph page consumes the contract; playbook + conventions docs | 1, 2, 3 |
| **1 — Timeline** | Append-only `events` (migration 0009); `emitEvent()` in every app action + MCP write tool; home activity feed ("my projects" default); per-object History panel; `brain_timeline` MCP tool | 3, 4 |
| **2 — Semantic linking** | `relationship_types` registry; `links.status` (suggested/confirmed); "Connect" action + backlinks panel everywhere; `search_queries` logging; `brain_link` / `brain_connections` | 1, 4 |
| **3 — GitHub connector** *(gated)* | `Connector` interface + reference implementation; commits/PRs as objects linked to projects and tickets; `ingested` events | 1, 3 |
| **4 — Retrieval v2** *(gated)* | `SearchProvider` composer; pgvector per `ai-readiness.md`; Graphify `graph.json` per project in Storage + `brain_code_query` / `brain_code_impact` / `brain_code_path` | 3 |
| **5 — Super-graph** *(gated)* | `code_entity`/`code_community` registered (one row each); `syncCodeLinks()` stitches code to decisions/tasks/prompts/people; graph code layer via `get_neighborhood` RPC | 1, 4 |
| **6 — People features** *(gated)* | Academy auto-tour from Graphify communities; grounded agents (Brain/Graphify MCP in `agents.tools[]`); blast-radius notes from the outbox; Brain-health panel | 2, 4 |

---

## Part 4 — Growth-stage topology (build for A, don't block B or C)

| | Stage A — now (3 founders) | Stage B — cohort (~10–25) | Stage C — multiple startups |
|---|---|---|---|
| Hosting | Vercel + Supabase free tier | + one small always-on worker (Graphify HTTP-MCP, ingestion, embeds) | workers per concern; queue/event-driven |
| MCP | local stdio per developer | hosted HTTP MCP (API-keyed) | per-org endpoints |
| Auth | email allowlist | roles + `project_members` — only policy-function bodies change | org/workspace scoping |
| Events | single table, indexed | + workers consuming the outbox | partition by month |
| Graph | neighborhood RPC | same | dedicated graph service, same interface |
| Connectors | GitHub via cron | + AI-session, meetings | federated/merged brains |

**Standing rule:** never build a Stage-C mechanism at Stage A — but never make
a choice that requires *unwinding* to reach it. That is what the registry,
policy functions, outbox, provider interfaces, and neighborhood RPC are for.
