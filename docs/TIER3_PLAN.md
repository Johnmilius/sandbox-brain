# Tier 3 Implementation Plan

Design-judgment features from [`docs/TODO.md`](./TODO.md) Tier 3, worked into concrete,
executable specs. Written for an implementing agent (Sonnet 5) to pick up item by item.

> Tier 3 items are ambiguous by nature — this doc makes the design calls so the
> implementer can focus on execution. Where a call is genuinely optional, it's
> marked **Decision:** with the rationale, and alternatives are noted.

---

## 0. How to use this doc

- Each item is self-contained: **Intent → Decisions → Data model → Backend → Frontend → MCP → Edge cases → v1 scope → Acceptance → Files.**
- Do **one item per branch/PR.** Items are ordered by the recommended sequence (§2); several are independent and can be parallelized.
- Before writing code, read §1 (conventions & gotchas). They are non-obvious and will bite you otherwise.
- Keep each item's v1 scope tight. "Defer" lists are deliberate — don't gold-plate.

---

## 1. Repo conventions & gotchas (read before coding)

**Framework.** Per [`AGENTS.md`](../AGENTS.md), this is a modified Next.js (16.2.10) with
breaking changes vs. training data. **Before writing any route handler, server action,
file-upload, or dynamic-API code, read the relevant guide under
`node_modules/next/dist/docs/`.** Confirmed local quirks already in use:
- `params` and `searchParams` are **Promises** — `await` them (see [`src/app/notes/[id]/page.tsx`](../src/app/notes/[id]/page.tsx)).
- Pages are RSC; interactivity lives in `"use client"` components.

**Database changes require TWO edits, always:**
1. A new migration `supabase/migrations/000N_*.sql` (next number is **0003**). Applied by
   hand via the Supabase SQL editor or `npm run db:push` — the project may not be linked.
2. A matching hand-edit to [`src/lib/database.types.ts`](../src/lib/database.types.ts). That
   file is hand-maintained (regen via `npm run db:types` only works once linked, and it
   overwrites). Update `Row`/`Insert`/`Update`, any enums/unions, and the convenience aliases.

**RLS.** Every table is team-scoped. New tables need:
```sql
alter table public.<t> enable row level security;
create policy "team full access on <t>" on public.<t> for all
  to authenticated using (public.is_team_member()) with check (public.is_team_member());
```
Full-text columns follow the `search_document tsvector generated always as (...) stored`
pattern + a GIN index (see any table in [`0001_init.sql`](../supabase/migrations/0001_init.sql)).

**Entity-type enums are in three places** and must stay in sync when you add a type:
- DB `check` constraints on `public.links` (currently: project, prompt, note, knowledge_item, profile — **no** time_entry) and `public.taggables` (same + time_entry).
- The `EntityType` TS union in `database.types.ts`.
- Graph: `GraphNode["type"]` union + `TYPE_COLORS` in [`graph-view.tsx`](../src/components/graph/graph-view.tsx) + `TYPE_LABELS` in [`graph/page.tsx`](../src/app/graph/page.tsx).

**Server actions** live in `src/app/<area>/actions.ts` (`"use server"`), use
`createClient()` from `@/lib/supabase/server`, return `{ error: string | null }` (or
`{ id, error }`), and call `revalidatePath(...)` for every affected route. Mirror the
existing files exactly.

**Tags & links helpers:** [`src/lib/tags.ts`](../src/lib/tags.ts) (`setTagsForEntity`,
`getTagsByEntity`) and [`src/lib/wiki-links.ts`](../src/lib/wiki-links.ts). Graph edges live
in the `links` table (`source_type/source_id → target_type/target_id`, `relationship`).

**base-ui `<SelectValue />` gotcha.** A bare `<SelectValue />` renders the selected *value*
(e.g. a raw UUID or `__none__`), not the item label. Use the render-prop form:
```tsx
<SelectValue>{(v) => projects.find(p => p.id === v)?.name ?? "Select…"}</SelectValue>
```
Several existing dialogs still have the bare form ([`prompt-form-dialog.tsx`](../src/components/prompts/prompt-form-dialog.tsx),
[`knowledge-form-dialog.tsx`](../src/components/brain/knowledge-form-dialog.tsx),
[`manual-entry-dialog`'s were fixed]). Fix any you touch.

**MCP server** ([`mcp/`](../mcp/)) mirrors the web actions using the **service-role key**
(bypasses RLS), so every write **must set `user_id`/`author_id`/`created_by` explicitly** to
`getActor().id`. It intentionally has **no delete tools**. Tag/wiki logic is duplicated in
[`mcp/src/helpers.ts`](../mcp/src/helpers.ts) — keep it in sync with `src/lib/*`. Build with
`tsc` in `mcp/`. Adding MCP tools is **optional for most v1 scopes** (called out per item).

**Verification.** The app is gated behind Google OAuth (currently paused), so browser
verification of authed pages is limited. After each item run **`npx tsc --noEmit`** and
**`npm run lint`** (both currently clean), plus a `next build` for route-handler/RSC changes.
A dev server usually runs on `:3000`.

---

## 2. Recommended sequencing

Ordered for dependency + risk. `[indep]` = no dependency on earlier items (parallelizable).

1. **#4 Prompt favorites** `[indep]` — small, isolated, high value. Good first slice; no enum churn.
2. **#7 Graph filters + authorship edges** `[indep]` — answers the "who recorded this?" question directly; no schema.
3. **#12 Session activity (auto-associate by date+person)** `[indep]` — no schema for the auto version; leverages authorship data.
4. **#7b Computed relationship edges** — builds on the #7 graph work.
5. **#4b Agents section** — new entity + entity-type enum extension; references favorite prompts from #4.
6. **#15 File/folder/repo upload** — largest and riskiest; phase it; do last.

Rationale: front-load the schema-free, high-signal work (favorites, graph, sessions), then
the two big data-model items (agents, uploads) once the patterns are warm.

---

## Item #4 — Prompt favorites (team-canonical prompts)

**Intent.** Mark high-value prompts so AI instructions stay *consistent and uniform across
developers*. The emphasis on "consistent across developers" means favorites are a **team-level
curation signal**, not a personal bookmark.

**Decisions.**
- **Team-wide boolean, not per-user.** Add `is_favorite boolean` on `prompts`. All data here is
  team-shared under one RLS policy, so a single flag matches "uniform across devs" and is the
  simplest thing that works. *Alternative considered:* a `prompt_favorites(prompt_id, user_id)`
  join for per-person stars — rejected for v1 because it fragments the "canonical set" the user
  actually asked for. If per-user stars are wanted later, add the join table without removing the
  flag.
- Favorite is **distinct from `rating`** (1–5 quality score already exists). Rating = "how good
  was the output"; favorite = "use this one." Keep both.
- Favorites become the natural curated dataset for future fine-tuning (#4's stretch goal) — no
  work needed now beyond making the flag queryable.

**Data model** (migration `0003_prompt_favorites.sql`):
```sql
alter table public.prompts add column is_favorite boolean not null default false;
create index prompts_favorite_idx on public.prompts (is_favorite) where is_favorite;
```
Update `database.types.ts`: add `is_favorite: boolean` to prompts `Row`, `is_favorite?: boolean`
to `Insert`/`Update`.

**Backend** ([`src/app/prompts/actions.ts`](../src/app/prompts/actions.ts)):
- Add `export async function togglePromptFavorite(id: string, value: boolean)` → update the row,
  `revalidatePath("/prompts")`.
- Include `is_favorite` in the `PromptInput`/`toRow` path if you also expose it in the edit form
  (optional; the toggle is the primary UX).

**Frontend.**
- [`prompt-card.tsx`](../src/components/prompts/prompt-card.tsx): add a star toggle button
  (lucide `Star` / filled when favorite) next to Copy/Edit/Delete, wired to `togglePromptFavorite`
  in a `useTransition`. Show a filled star badge in the header for favorites.
- [`prompt-filters.tsx`](../src/components/prompts/prompt-filters.tsx): add a "Favorites only"
  toggle → `?favorite=1` search param.
- [`prompts/page.tsx`](../src/app/prompts/page.tsx): read `favorite` from `searchParams`; when set,
  `query.eq("is_favorite", true)`. **Sort favorites first** regardless: `.order("is_favorite",
  {ascending:false}).order("created_at",{ascending:false})`. Add a "★ N favorites" bit to the
  header summary line.

**MCP** (recommended, small): in [`mcp/src/tools/prompts.ts`](../mcp/src/tools/prompts.ts) add a
`favorites_only` boolean to `brain_search_prompts` (`q.eq("is_favorite", true)`) and mark faves
with ★ in output. A `brain_favorite_prompt` write tool is optional. This is what lets an agent
pull "the canonical prompts" — high value for the stated goal.

**Edge cases.** Toggling should be optimistic-but-safe (disable during transition). Deleting a
prompt already cleans taggables; no extra cleanup needed for the flag.

**v1 scope:** flag + toggle + filter + favorites-first sort + MCP filter.
**Defer:** per-user stars, fine-tuning export.

**Acceptance:** can star/unstar from the card; "Favorites only" filters; favorites sort first;
`tsc`+`lint` clean; MCP search can return favorites-only.

**Files:** `0003_*.sql`, `database.types.ts`, `prompts/actions.ts`, `prompt-card.tsx`,
`prompt-filters.tsx`, `prompts/page.tsx`, `mcp/src/tools/prompts.ts`.

---

## Item #4b — Agents section

**Intent.** Save "used/active agents" (Claude subagents, custom GPTs, Cursor rules, etc.) so the
team reuses consistent agent definitions, ideally wired to the favorite prompts from #4.

**Decisions.**
- **Dedicated `agents` table, not a `knowledge_items` kind.** Agents have first-class structure
  (system prompt, model, tool list, status) and their own page/relationships; shoehorning into
  `data jsonb` on knowledge_items would make them unsearchable/unlinkable in a natural way.
  *Alternative:* add `kind='agent'` to knowledge_items — rejected; the relational shape and a
  dedicated page are worth a table.
- **Own page `/agents`**, structured like `/prompts` (list + form dialog + card + filters).
- **Agent↔prompt links via the generic `links` table**, which requires adding `'agent'` to the
  entity-type enums (the cross-cutting change from §1). This lets agents show up in the graph and
  reuse the existing link machinery, rather than inventing a bespoke join table.
- Model/tools stored as simple text/`text[]`; no validation against a live catalog.

**Data model** (migration `0004_agents.sql`):
```sql
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  system_prompt text,
  model text,                         -- freeform, e.g. 'claude-opus-4-8'
  tools text[] not null default '{}', -- freeform tool/capability names
  status text not null default 'active' check (status in ('active','archived')),
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')
      || ' ' || coalesce(system_prompt,''))
  ) stored
);
create index agents_search_idx on public.agents using gin (search_document);
create trigger agents_set_updated_at before update on public.agents
  for each row execute function public.set_updated_at();
alter table public.agents enable row level security;
create policy "team full access on agents" on public.agents for all
  to authenticated using (public.is_team_member()) with check (public.is_team_member());

-- Extend entity-type enums to include 'agent'
alter table public.links  drop constraint links_source_type_check,  add constraint links_source_type_check  check (source_type in ('project','prompt','note','knowledge_item','profile','agent'));
alter table public.links  drop constraint links_target_type_check,  add constraint links_target_type_check  check (target_type in ('project','prompt','note','knowledge_item','profile','agent'));
alter table public.taggables drop constraint taggables_entity_type_check, add constraint taggables_entity_type_check check (entity_type in ('project','prompt','note','knowledge_item','profile','time_entry','agent'));
```
> Verify the real constraint names first (`\d+ public.links` in the SQL editor); Postgres
> auto-names them `<table>_<col>_check` but confirm before dropping.

Update `database.types.ts`: add the `agents` table types, extend `EntityType` union with
`"agent"`, add an `Agent` convenience alias.

**Backend** (`src/app/agents/actions.ts`): `createAgent`, `updateAgent`, `deleteAgent`,
mirroring [`prompts/actions.ts`](../src/app/prompts/actions.ts) (tags via `setTagsForEntity`
with entity type `"agent"`; delete cleans taggables + any `links` rows referencing the agent).
To attach favorite prompts: write `links` rows `agent → prompt` with `relationship='uses'`
(a `setAgentPrompts(agentId, promptIds)` helper that rewrites those edges).

**Frontend.**
- `/agents/page.tsx` mirroring `/prompts` (auth guard, fetch agents + projects + tags + prompts).
- `components/agents/agent-form-dialog.tsx` — name, description, system prompt (Textarea), model,
  tools (reuse [`TagInput`](../src/components/tag-input.tsx) for the string[] of tools), status,
  project, tag input, and a multi-select of prompts to attach (start simple: a checklist of
  favorite prompts).
- `components/agents/agent-card.tsx` — show model/status/tools, copy-system-prompt button, linked
  prompts, Edit + `DeleteConfirmButton`.
- Add `{ href: "/agents", label: "Agents" }` to `NAV_LINKS` in
  [`app-header.tsx`](../src/components/app-header.tsx).

**Graph.** Add agent nodes + `agent` to `TYPE_COLORS`/`TYPE_LABELS`; agents connect to prompts
(`uses` links) and projects. (Coordinate with #7 if done in parallel.)

**MCP** (optional v1): `brain_save_agent` / `brain_list_agents` in a new
`mcp/src/tools/agents.ts`, registered in [`mcp/src/index.ts`](../mcp/src/index.ts).

**Edge cases.** Extending check constraints is the risky part — confirm names, and test that
existing links/taggables still validate. `tools text[]` round-trips fine through supabase-js as a
JS array.

**v1 scope:** table + `/agents` CRUD page + nav + attach favorite prompts + graph nodes.
**Defer:** MCP tools, agent versioning/history, importing agent defs from files.

**Acceptance:** create/edit/delete agents; attach prompts; agents appear in nav and graph;
enum migration applied without breaking existing links/taggables; `tsc`+`lint` clean.

**Files:** `0004_*.sql`, `database.types.ts`, `app/agents/{page,actions}.tsx/ts`,
`components/agents/*`, `app-header.tsx`, graph files, (opt) `mcp/src/tools/agents.ts` + `index.ts`.

---

## Item #7 — Graph filtering (esp. by person) + authorship edges

**Intent.** Filter the graph to see relationships clearly — "by person ID" especially. The user
asks pointedly: *"Does each note have a person ID attached so we know who recorded it?"*

**Answer to that question (informs the work):** Yes — `notes.author_id`, `prompts.user_id`,
`knowledge_items.created_by`, `time_entries.user_id` all reference `profiles`. **But the graph
currently only draws person→project edges (via time entries).** It never connects people to the
notes/prompts/knowledge they authored. So step one of #7 is to *surface authorship as edges*;
only then does "filter by person" become meaningful.

**Decisions.**
- **Add authorship edges** at graph-build time in [`graph/page.tsx`](../src/app/graph/page.tsx):
  `profile → note` (author_id), `profile → prompt` (user_id), `profile → knowledge_item`
  (created_by). Fetch those columns (currently the selects omit them).
- **Client-side filtering**, not re-querying. Data volumes are V1-small and everything is already
  loaded; filtering in [`GraphView`](../src/components/graph/graph-view.tsx) is instant and avoids
  round-trips. Attach filter metadata to each node.
- Filter controls for v1: **by type** (make the existing legend chips clickable toggles), **by
  person**, **by project**. Tag filtering can come with #7b.
- "By person" behaves as **focus**: show the selected person + everything they authored + the
  immediate neighbors of those items (so context isn't lost).

**Data model:** none.

**Frontend.**
- Extend `GraphNode` with optional metadata: `authorId?: string`, `projectId?: string`,
  `tags?: string[]` (tags used by #7b). Populate in `graph/page.tsx`.
- New `components/graph/graph-filters.tsx` (client): type toggles, a person `Select`
  (from profiles), a project `Select`. Lift filter state into a client wrapper (e.g.
  `graph-explorer.tsx`) that owns state and renders `GraphFilters` + `GraphView`, since
  `graph/page.tsx` is an RSC. Pass full nodes/edges down; compute the visible subset with
  `useMemo`.
- Filtering logic: start from all nodes; if a person is selected, keep that profile + nodes whose
  `authorId === personId` + nodes directly linked to those (walk `edges` one hop); intersect with
  active type toggles and project filter. Drop edges whose endpoints were filtered out (reuse the
  existing `nodeIds.has(...)` guard pattern).

**MCP:** none.

**Edge cases.** Force-graph mutates the node/link objects it's given (adds `x/y`, may replace
`source`/`target` with node refs). Filtering must produce **fresh arrays/objects each render**
(map to new objects) so re-filtering doesn't feed mutated links back in. Preserve the existing
`url`-based click-through.

**v1 scope:** authorship edges + type/person/project filters with focus behavior.
**Defer:** tag filter (→ #7b), multi-hop depth control, saved views.

**Acceptance:** selecting a person shows what they recorded and its neighbors; type toggles
hide/show categories; project filter narrows to one project's cluster; clicking nodes still
navigates; `tsc`+`lint` clean.

**Files:** `graph/page.tsx`, `graph-view.tsx`, new `graph-filters.tsx` + `graph-explorer.tsx`.

---

## Item #7b — Automatic linking & tagging (surface relationships without manual work)

**Intent.** *"Programmatically add linking tags to items so we don't manage that ourselves —
relationships surface faster."* This is the most open-ended item; approach it in **safe,
reversible phases** and do not silently mutate user data early.

**Decisions (phased).**
- **Phase A — computed edges (no persistence): do this in v1.** At graph-build time, derive
  "soft" relationships from signals we already have and render them with a distinct style
  (e.g. dashed/lighter), separate from explicit `links`:
  - **shared-tag**: items sharing a tag get a soft edge (needs tags on nodes from #7).
  - **shared-project**: items on the same project (partly implicit today).
  - **co-authored / same-session**: items created by the same person in the same time window
    (ties into #12).
  This satisfies "surface relationships faster" with **zero data-management burden and zero risk**
  — nothing is written, so nothing needs cleanup. Cap edges (e.g. skip tags shared by >N items) to
  avoid hairballs.
- **Phase B — persisted auto-links (opt-in, later):** a routine that scans an item's text for
  **mentions of other items' titles** (generalizing wiki-links across entity types) and writes
  `links` rows with `relationship='auto'`. Provenance in the relationship value lets the UI show
  auto vs. manual and lets a user purge them (`delete ... where relationship='auto'`). Requires a
  title index and collision handling.
- **Phase C — semantic (defer):** embeddings via Supabase `pgvector` for similarity suggestions.
  Heavy; explicitly out of scope now.
- **Auto-tagging:** prefer **suggestion over silent application.** Surface candidate tags (matches
  against the existing tag vocabulary found in the text) in the create/edit forms as one-click
  chips. Don't auto-write tags without a human confirm in v1 — silent tagging is hard to trust and
  hard to undo.

**Data model:** none for Phase A. Phase B reuses `links` with `relationship='auto'` (no schema
change; maybe an index on lower(title) per entity for mention scanning).

**Frontend (Phase A):** compute soft edges in `graph/page.tsx`; add an `edgeKind`
(`'explicit' | 'shared_tag' | 'shared_project'`) to `GraphEdge`; style soft edges differently in
`GraphView` (`linkColor`/`linkLineDash`); add a "show suggested links" toggle in the #7 filter bar.

**MCP:** none in v1. (Phase B could later expose a `brain_suggest_links` tool.)

**Edge cases.** Combinatorial blowup — a tag on 50 items would create 50·49/2 edges. Cap per-tag
fan-out and total soft edges; make the toggle default *off* if the graph is large. Keep soft edges
purely visual so there's nothing to reconcile.

**v1 scope:** Phase A computed shared-tag/shared-project edges + toggle + suggested-tag chips in
forms.
**Defer:** Phase B persisted auto-links, Phase C embeddings, LLM auto-tagging.

**Acceptance:** toggling "suggested links" reveals dashed relationships from shared tags/projects
without writing to the DB; create/edit forms suggest existing tags found in the content; graph
stays legible (fan-out capped); `tsc`+`lint` clean.

**Files:** `graph/page.tsx`, `graph-view.tsx`, `graph-filters.tsx`; form dialogs for suggested-tag
chips ([`prompt-form-dialog.tsx`](../src/components/prompts/prompt-form-dialog.tsx),
[`knowledge-form-dialog.tsx`](../src/components/brain/knowledge-form-dialog.tsx),
[`new-note-dialog.tsx`](../src/components/notes/new-note-dialog.tsx)).

---

## Item #12 — Link work to time frames; search by date range + person

**Intent.** *"Link items to things done during that time frame, attached to the time log… a search
that links dates of notes/prompts by date range and person, so we can see what was done during a
session."*

**Decisions.**
- **Lead with automatic association — no schema needed.** A completed time entry has
  `user_id`, `started_at`, `ended_at`. "What was done during this session" = notes/prompts/knowledge
  **created by that same person whose `created_at` falls in (or overlaps) that window.** This is
  the high-value 80% and needs zero new tables.
  - `notes` (author_id, created_at), `prompts` (user_id, created_at),
    `knowledge_items` (created_by, created_at). Match `user_id`/author + `created_at` between
    `started_at` and `ended_at`.
  - Caveat: notes are often edited later; `created_at` = "started during the session" is the right
    signal for v1. Optionally also surface items whose `updated_at` overlaps, labeled "edited."
- **Explicit pin/link is a later add-on.** The `links` check constraint currently **excludes
  `time_entry`** (unlike `taggables`, which includes it). Explicit "attach this note to this
  session" would need to extend that constraint (like #4b does for `agent`). Defer it; the
  automatic view covers the stated need first.
- Add a **person filter** to the time page (complements #11's per-person metrics).

**Data model:** none for v1. (Explicit linking later: extend `links` source/target checks to
include `'time_entry'` and add a `relationship='session'`.)

**Backend.** A helper `getSessionActivity(supabase, entry)` (or inline in a session page): three
queries filtered by author == `entry.user_id` and `created_at` within the window; return grouped
results. For the list view, batch it: fetch the window's items once and bucket by entry to avoid
N+1.

**Frontend.**
- **Session detail:** either an expandable row on [`time/page.tsx`](../src/app/time/page.tsx) or a
  `/time/[id]/page.tsx` route (params is a Promise — see §1). Show the entry + a "During this
  session" list of created notes/prompts/knowledge with links. A route is cleaner if the list grows;
  an expander is faster to ship — **Decision: expandable row for v1** (no new route, less surface).
- **Person filter** on the time page via `?who=<userId>` search param over the entries table.
- Optional: on a note/prompt detail, a "logged during: <project> session on <date>" backlink
  (reverse of the above). Nice-to-have, not required.

**MCP:** optional `brain_session_activity` (given a date range + actor, list created items). Useful
for standups; defer unless cheap.

**Edge cases.** Timezone: `time_entries` store local-time-derived ISO and the app renders in server
tz (a known V1 limitation, see #11 note). Keep comparisons in UTC/ISO and don't introduce a second
tz model. Running timers (`ended_at is null`) have no window — skip them. Items created outside any
session simply don't appear (that's fine).

**v1 scope:** automatic "during this session" activity on each completed entry + person filter.
**Defer:** explicit pinning (needs `links` enum change), `/time/[id]` route, reverse backlinks, MCP.

**Acceptance:** expanding a completed entry lists items that person created during the window, each
linking to the item; person filter narrows the entries table; running timers don't break it;
`tsc`+`lint` clean.

**Files:** `time/page.tsx` (+ a `components/time/session-activity.tsx` client expander),
`src/lib/format.ts` if new range helpers are needed.

---

## Item #15 — File / folder / GitHub-repo uploadability for the brain

**Intent.** *"Add an entire project via GitHub repo, file, or folder upload instead of copy/paste."*

**Current state.** The brain already supports **single-file** upload to the private Supabase
Storage bucket `files` (kinds `document`/`project_archive`; see
[`knowledge-form-dialog.tsx`](../src/components/brain/knowledge-form-dialog.tsx) lines ~93–108) and
stores a **GitHub repo URL** as text (but does not ingest it). Bucket + policies exist in
[`0002_storage.sql`](../supabase/migrations/0002_storage.sql). **Free tier ≈ 1 GB total** — the form
already warns about this.

**Decisions (phased — this is the biggest/riskiest item).**
- **Phase 1 — multi-file & folder upload (v1).** Use `<input type="file" multiple>` and a second
  `webkitdirectory` input for folder upload. Upload each file to storage under a shared prefix
  (`project_archive/<uuid>/…`), and create **one** `knowledge_item` (kind `project_archive` or
  `document`) whose `data.files = [{ path, name, size, type }]` manifest lists them. The card lists
  files with download links (signed URLs from the private bucket). **Enforce client-side caps**
  (per-file size, total size, file count) and **skip junk** (`.git/`, `node_modules/`, binaries) for
  folder uploads. No content indexing yet — search still works over title/description/tags.
- **Phase 2 — GitHub repo import (spec now, build behind Phase 1).** Given a repo URL, fetch the
  default-branch tarball via the GitHub API server-side, filter to **text files under a size cap**,
  and either (a) store the archive + a file manifest, or (b) extract notable files' contents into
  the item's `content`/child items for full-text search. Needs a **Route Handler** (not a server
  action) for the heavier fetch/stream work, a `GITHUB_TOKEN` env var (rate limits + private repos),
  and hard limits (max files, max bytes, ignore binaries/lockfiles). Store repo URL + resolved
  commit SHA in `data`.
- **Phase 3 — content indexing / semantic search (defer).** Parse PDFs/docx, index file text into
  `search_document` or a child table, optionally embeddings (`pgvector`).

**Framework note (critical).** Phase 2 involves route handlers, streaming, and possibly the
`request`/`params` async APIs — **read `node_modules/next/dist/docs/` for route handlers and dynamic
APIs before writing it** (§1). Don't assume App Router semantics from training data.

**Data model.** Phase 1: none (manifest rides in existing `data jsonb`; files go to the existing
bucket). Phase 2: none required if storing as archive+manifest; add columns only if you index
contents. If uploads outgrow "attach to a knowledge_item," consider a dedicated `files` table later
— not needed for v1.

**Backend.**
- Phase 1: extend [`brain/actions.ts`](../src/app/brain/actions.ts) `KnowledgeInput` to accept a
  `files` manifest (array) written into `data`. Uploads happen **client-side** (as today, using the
  browser Supabase client) before calling the action; the action just persists the manifest. On
  delete, remove **all** manifest paths from storage (today it removes a single `file_path`).
- Phase 2: `src/app/api/brain/import-repo/route.ts` (Route Handler) that validates the URL, fetches
  via GitHub API using `GITHUB_TOKEN`, applies caps/filters, uploads to storage, and creates the
  knowledge_item. Return progress/summary. Guard with the same team-auth check used elsewhere.

**Frontend.**
- Phase 1: in `knowledge-form-dialog.tsx`, when kind is `document`/`project_archive`, allow multiple
  files and add a "Upload folder" affordance (`webkitdirectory`). Show a pre-upload list with sizes
  and enforce caps with clear errors. Update [`knowledge-card.tsx`](../src/components/brain/knowledge-card.tsx)
  to render the file manifest with download links (generate signed URLs).
- Phase 2: an "Import from GitHub" action on the brain page that posts the URL to the route handler
  and shows progress + result.

**MCP:** out of scope (uploads are inherently UI/file-driven).

**Edge cases & risks.** Storage quota (1 GB) — caps are mandatory; prefer links for large repos.
Binary/huge files, `node_modules`, secrets in uploads (warn; consider excluding dotfiles). Private
repos need a token; handle 404/403 gracefully. Signed-URL expiry for downloads. Partial-failure
cleanup if some files upload then the item insert fails (best-effort remove uploaded objects on
error). GitHub API rate limits without a token (~60/hr).

**v1 scope:** Phase 1 multi-file + folder upload with manifest, caps, listing/downloads, and
delete-cleanup of all files.
**Defer:** Phase 2 GitHub import (spec'd above), Phase 3 content indexing/embeddings.

**Acceptance:** can select multiple files or a folder, see them listed with sizes, save one brain
item that lists and downloads them; deleting the item removes every stored file; caps reject
oversized uploads with a clear message; `tsc`+`lint` clean.

**Files:** `knowledge-form-dialog.tsx`, `knowledge-card.tsx`, `brain/actions.ts`,
`database.types.ts` (only if you formalize the manifest type); Phase 2: `app/api/brain/import-repo/route.ts`,
`.env.local` (`GITHUB_TOKEN`), brain page import UI.

---

## Appendix — per-item checklist

For **every** item before opening a PR:

- [ ] Read the relevant `node_modules/next/dist/docs/` guide if touching routes/actions/uploads/dynamic APIs.
- [ ] Migration added as `supabase/migrations/000N_*.sql` **and** `src/lib/database.types.ts` updated to match (Row/Insert/Update, enums, aliases).
- [ ] New tables have RLS enabled + the `is_team_member()` team policy.
- [ ] Entity-type changes applied in **all** locations (DB check constraints, `EntityType`, graph type union + colors + labels).
- [ ] Any `<SelectValue />` you touched uses the render-prop form.
- [ ] MCP tools/helpers updated where the item's scope calls for it, and `mcp/` rebuilt (`tsc`).
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean; `next build` for route-handler/RSC changes.
- [ ] `revalidatePath` called for every affected route in server actions.
- [ ] `docs/TODO.md` Tier 3 item marked done.
