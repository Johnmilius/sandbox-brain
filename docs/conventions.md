# Codebase conventions

The rules that keep this repo understandable as people join
([roadmap](vision/ROADMAP.md) Pillar 2). If you change a convention, change
this file in the same PR.

## Layout

- **`src/`** — the Next.js app (App Router). One folder per hub section under
  `src/app/`; server mutations live in that section's `actions.ts`.
- **`mcp/`** — the standalone MCP server. One file per domain under
  `mcp/src/tools/`, registered in `mcp/src/index.ts`. No delete tools by
  design — destructive actions stay in the web UI.
- **`packages/core`** — the shared contract: object types (`ObjectRef`,
  `nodeKey`, `urlFor`), relationship vocabulary, event verbs + `emitEvent`,
  wiki-link logic. **Logic needed by both the app and the MCP server goes
  here, never copied.** (Known exception: tag helpers are still mirrored in
  `src/lib/tags.ts` and `mcp/src/helpers.ts` — next candidate to move.)
- **`supabase/migrations/`** — numbered, additive-only. Never edit an applied
  migration; add a new one.

## Database rules

- Every content table follows the standard contract — see
  [playbook-new-object-type.md](playbook-new-object-type.md).
- **RLS policies only call shared policy functions** (`is_team_member()`).
  When roles/project membership arrive, function bodies change and no policy
  is rewritten.
- Entity types are rows in the `object_types` registry; `links`/`taggables`
  FK to it. Adding a type never ALTERs a shared table.
- The `events` table is **append-only** (no update/delete policies). Its
  `processed_at` column is the future outbox seam for background workers —
  don't repurpose it.

## Events (the timeline)

- Every write path emits exactly one event: app actions call `emitEvent()`
  from `@sandbox-brain/core`; MCP tools call `emitMcpEvent()` from
  `mcp/src/helpers.ts` (adds actor + `source: 'mcp'`).
- Denormalize `label`s at emit time (the feed must render without joins).
  Pass `projectId` whenever the action is scoped to a project.
- Emit for meaningful moments, not churn — e.g. tasks emit on create/claim/
  done, not on every board drag.
- `emitEvent` never throws; a failed event write must never break the user
  action.

## TypeScript / packages

- npm workspaces: root (Next app) + `packages/core` + `mcp`. Core builds to
  `dist/` (`npm run build -w @sandbox-brain/core`); rebuild it after editing
  core before typechecking dependents. The MCP server builds with
  `npm run build -w mcp` (its `dist/` is what `.mcp.json` runs).
- `src/lib/database.types.ts` is hand-maintained to mirror migrations until
  the linked project can regenerate it (`npm run db:types`).

## Verifying

- `npx vitest run` — unit tests (includes `packages/core`).
- `npx tsc --noEmit` — whole-repo typecheck.
- `npm run dev` — the home feed, graph, and object History panels degrade
  gracefully when migrations 0008/0009 aren't applied yet.
