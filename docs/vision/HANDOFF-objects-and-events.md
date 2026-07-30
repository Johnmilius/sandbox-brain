# Handoff: Objects + Events foundation (branch `feat/brain-os-foundation`)

**Audience:** another AI agent building on the Sandbox Brain app toward the
same vision (see [ROADMAP.md](ROADMAP.md),
[OS_for_Orginizational_Intelligence.md](OS_for_Orginizational_Intelligence.md),
[scalability.md](scalability.md)).

**Purpose:** understand exactly what this branch changed, why, and how to merge
it with your in-flight work without breaking either side.

**TL;DR:** This branch implements **Phase 0 (the object contract)** and
**Phase 1 (the events timeline)** from the roadmap. It adds two migrations
(`0008`, `0009`), a new shared package (`packages/core`), event emission on
every write path (app + MCP), a home activity feed + per-object History panel
driven by events, and a `brain_timeline` MCP tool. Nothing is applied to the
live database yet — that's a manual user step. All builds/tests are green.

---

## 1. The mental model (read this first)

Everything reduces to **six primitives** (roadmap Part 1). This branch builds
the first three; the rest are stubbed for later phases:

| # | Primitive | Status on this branch |
|---|-----------|----------------------|
| 1 | **Objects** — every entity addressed as `(object_type, object_id)` | ✅ built: `object_types` registry + `objects` view + `packages/core` contract |
| 2 | **Typed links** — relationships carry meaning | ⚠️ vocabulary defined in `packages/core`, not yet enforced/UI (Phase 2) |
| 3 | **Events** — append-only log; timeline is derived | ✅ built: `events` table + `emitEvent` everywhere + feed + `brain_timeline` |
| 4 | Retrieval providers (fulltext/vector/graph) | ❌ Phase 4 |
| 5 | MCP as model-agnostic door | ✅ already true; extended with `brain_timeline` |
| 6 | Connectors (GitHub, etc.) | ❌ Phase 3 |

If your work also touches these primitives, **adopt this branch's contract
rather than inventing a parallel one** — that's the whole point of the shared
package.

---

## 2. What changed, by area

### 2a. Database (migrations — NOT yet applied to prod)

- **`supabase/migrations/0008_object_registry.sql`**
  - New `object_types` registry table (name, label, url_pattern, table_name),
    seeded with all 11 existing entity types.
  - **Converts the `links.source_type` / `links.target_type` / `taggables.entity_type`
    CHECK constraints into foreign keys** onto `object_types`. This retires the
    old 0004–0007 pattern of ALTER-ing two shared tables per new type — now
    registering a type is one INSERT.
  - New `objects` **view** (security_invoker) unioning every titled content
    table into `(object_type, object_id, title, created_by, created_at)`.
- **`supabase/migrations/0009_events.sql`**
  - New append-only `events` table: `(actor_id, verb, object_type, object_id,
    object_label, target_type, target_id, target_label, project_id, source,
    metadata, occurred_at, processed_at)`.
  - RLS: team read + insert-as-self only. **No update/delete policies** — the
    timeline is immutable.
  - `processed_at` is a deliberate **outbox** column for future background
    workers (Phase 3+ embeddings/notifications) — don't repurpose it.
  - Indexes for feed (`occurred_at desc, id desc`), per-object, per-actor,
    per-project, and unprocessed scans.

### 2b. New shared package `packages/core` (`@sandbox-brain/core`)

The single source of truth consumed by **both** the Next app and the MCP
server. Exports:
- `object-types.ts` — `OBJECT_TYPES`, `ObjectType`, `ObjectRef`,
  `OBJECT_TYPE_LABELS`, `isObjectType`, `urlFor`, `nodeKey`, `parseNodeKey`.
- `relationships.ts` — `RELATIONSHIPS` vocabulary (Phase 2 will move this to a
  DB registry table).
- `events.ts` — `EVENT_VERBS`, `EventInput`, and `emitEvent(db, input)`
  (never throws — a failed event write must not break the user action).
- `wiki-links.ts` — `extractWikiLinkTitles`, `rewriteWikiLinks`,
  `syncWikiLinks`. **This deduplicated wiki-link logic that previously existed
  in 3 places** (`src/lib/wiki-links.ts`, `src/app/notes/actions.ts`,
  `mcp/src/helpers.ts`). Those now re-export / delegate to core.
- `db.ts` — `MinimalDbClient`, a loose structural type so both the app's typed
  client and the MCP's untyped client satisfy the helpers.

### 2c. Event emission (every write path)

`emitEvent()` is now called from **every** app server action that creates/
updates/deletes meaningful state:
`src/app/{projects,time,prompts,brain,notes,ideas,tasks,agents,academy}/actions.ts`.
On the MCP side, a helper `emitMcpEvent()` in `mcp/src/helpers.ts` wraps
`emitEvent` with the actor + `source: 'mcp'`, called from
`mcp/src/tools/{projects,time,notes,prompts,knowledge,academy}.ts`.

Verb choices are intentional (avoid feed noise): tasks emit on
create/claim/done/update/delete but **not** every board drag; prompts emit
`favorited` only when favoriting, not un-favoriting.

### 2d. Frontend

- **`src/app/page.tsx`** — home feed now reads from the `events` table
  (`eventToFeedItem` in `src/lib/event-feed.ts`), **falling back to the legacy
  per-table union** when events are empty/absent (pre-migration safe).
- **`src/components/home/flowing-feed.tsx`** — added kind colors for the new
  object types and a keyset **"Load more"** button (server action
  `src/app/feed-actions.ts`, cursor on `(occurred_at, id)`, no OFFSET).
- **`src/components/history-panel.tsx`** — NEW server component; per-object
  History from events. Mounted on `src/app/notes/[id]/page.tsx` and
  `src/app/ideas/[id]/page.tsx`. Renders nothing when events are absent, so
  it's safe to mount anywhere.
- **`src/app/graph/page.tsx`** — refactored to build node ids/URLs via the
  `packages/core` contract (`nodeKey`/`urlFor`) instead of hand-rolled
  `type:id` strings. Behavior identical; now single-sourced.

### 2e. MCP server

- New tool **`brain_timeline`** (`mcp/src/tools/timeline.ts`) — "what happened,
  newest first," filterable by days/person/project. Registered in
  `mcp/src/index.ts`.

### 2f. Hand-written types

`src/lib/database.types.ts` is **hand-maintained** (it predates a linked
Supabase project). This branch added `object_types`, `events`, the `objects`
view, `EventSource`, and tightened `taggables.entity_type` / `EntityType`.
After the user runs `npm run db:types` against the live project, this file gets
regenerated and these hand entries are replaced.

---

## 3. ⚠️ Critical gotchas (will bite you if you miss them)

1. **`mcp/` must NOT be an npm workspace member.** The MCP SDK depends on
   `zod@3`; the Next app pulls `zod@4`. If `mcp` joins the root workspaces, npm
   hoists one `zod` and the two identities collide, making `tsc` OOM (4GB heap)
   on every `registerTool` call. **Fix in place:** root `package.json`
   workspaces is `["packages/*"]` only; `mcp/package.json` consumes core via
   `"@sandbox-brain/core": "file:../packages/core"` and keeps its own
   `node_modules` + lockfile. **Do not add `mcp` to workspaces.**

2. **Build order matters.** `packages/core` compiles to `dist/`. Rebuild it
   (`npm run build -w @sandbox-brain/core`) before building the app or mcp,
   which import from `@sandbox-brain/core` (i.e. its `dist/`).

3. **`tsconfig.json` (root) excludes `mcp` and `packages`** and narrows
   `include` to `src/**`. This was required to stop the app's typecheck from
   dragging the mcp/core trees into one giant program (also an OOM trigger).
   Each package typechecks under its own tsconfig.

4. **Stale `.next` breaks `next dev`.** After a production `next build`, running
   `next dev` can 404 every route. `rm -rf .next` fixes it.

5. **The PostgREST `.insert().select().single()` chain is an OOM landmine** in
   the MCP server's *untyped* client under some tsconfigs. In `mcp/src/tools/time.ts`
   the fix was to generate the id client-side (`randomUUID()`) and skip the
   returning select. If you add MCP writes and tsc OOMs, suspect this.

---

## 4. How to merge this with your work

### The likely collision points

| If your work… | Then… |
|---|---|
| Added its own migrations numbered 0008/0009 | **Renumber** — this branch owns 0008 (object registry) and 0009 (events). Yours become 0010+. |
| Added a new object/entity type | Register it in **both** `0008`'s `object_types` seed (or a new migration inserting a row) **and** `packages/core/src/object-types.ts` (`OBJECT_TYPES`, labels, urls). Add a UNION arm to the `objects` view. Follow [playbook-new-object-type.md](../playbook-new-object-type.md). |
| Edited the same `*/actions.ts` files | Merge both — keep your logic, keep the `emitEvent(...)` calls this branch added (they're additive, near the `revalidatePath` calls). |
| Built its own activity feed / timeline | **Reconcile onto the `events` table.** Don't run two parallel activity systems. `eventToFeedItem` is the mapping layer; extend it, don't fork it. |
| Duplicated wiki-link logic | Delete your copy; import from `@sandbox-brain/core`. |
| Touched `database.types.ts` | Manual merge (it's hand-written). Keep both sides' table/type additions. |
| Changed `package.json` / workspaces | Preserve `workspaces: ["packages/*"]` and the `@sandbox-brain/core` dep. **Never** add `mcp` to workspaces (gotcha #1). |
| Added MCP tools | Register in `mcp/src/index.ts`; emit via `emitMcpEvent()`; mind gotcha #5. |

### Recommended merge procedure

1. Branch off `dev`, merge `feat/brain-os-foundation` into your branch (or
   rebase yours onto it — this branch is foundational, so prefer it as the base).
2. Resolve conflicts using the table above.
3. From the repo root: `npm install`, then
   `npm run build -w @sandbox-brain/core`, `(cd mcp && npm run build)`,
   `npx vitest run`, `npx next build`. All four must pass.
4. `rm -rf .next && npm run dev` to smoke-test.

---

## 5. What is NOT done (do not assume these exist)

- **Migrations 0008/0009 are not applied to the live DB.** Until the user runs
  `npm run db:push`, the `events`/`objects`/`object_types` objects don't exist
  and the app runs on its legacy fallbacks. Everything is written to degrade
  gracefully — don't "fix" the fallbacks by assuming the tables exist.
- No typed-linking UI, relationship registry table, or `search_queries` log
  (Phase 2).
- No GitHub/any connector (Phase 3).
- No pgvector or Graphify code-graph retrieval (Phase 4).
- History panels are only on note + idea detail pages (other types are
  list/drawer UIs without a detail route).

## 6. Conventions to keep (from `docs/conventions.md`)

- Shared logic lives in `packages/core`, never copied between app and mcp.
- RLS policies only call shared functions (`is_team_member()`), never inline
  auth.
- Every write path emits exactly one event; `emitEvent` never throws.
- Migrations are additive-only and numbered; never edit an applied one.
- No AI attribution in commit messages (existing repo convention).

## 7. Verification snapshot at handoff time

- `npx vitest run` → 55 passing
- `packages/core` build, `mcp` build, `next build` (full typecheck) → all green
- dev server renders; login gate reached with no console errors (authed pages
  need a real Google sign-in, which the preview browser can't do)
