# Playbook: adding a new object type

Pillar 1 of [the roadmap](vision/ROADMAP.md): **a new type is a row, not a
redesign.** Follow these five steps and the new type is automatically
linkable, taggable, searchable, on the graph, and on the timeline.

Target: **≤ 1 hour, ≤ 6 files.** If a step forces you outside this list,
something regressed — fix the architecture, not the playbook.

## 1. Create the table (one migration)

New migration `supabase/migrations/00XX_<type>.sql` following the standard
content-table contract (copy `0006_ideas.sql` as the template):

- `id uuid primary key default gen_random_uuid()`
- `created_by uuid not null default auth.uid() references public.profiles (id)`
- `created_at` / `updated_at timestamptz not null default now()` + the
  `set_updated_at` trigger
- a generated `search_document tsvector` column + GIN index (search picks the
  type up for free)
- RLS enabled, with policies that **only** call the shared policy functions
  (`public.is_team_member()` today) — never inline auth logic
- kind-specific extras start in a `jsonb` column; promote a field to a real
  column only once you query or index it

## 2. Register the type (same migration)

```sql
insert into public.object_types (name, label, url_pattern, table_name)
values ('meeting', 'Meeting', '/meetings/{id}', 'meetings');
```

That one row is what lets `links` and `taggables` reference the type — no
ALTERs on shared tables (the FKs point at the registry).

## 3. Add the `objects` view arm (same migration)

```sql
create or replace view public.objects with (security_invoker = on) as
  ... existing arms ...
union all
  select 'meeting', id, title, created_by, created_at from public.meetings;
```

## 4. Add the type to the shared contract

In `packages/core/src/object-types.ts`: add the name to `OBJECT_TYPES`, a
label to `OBJECT_TYPE_LABELS`, and a route to the URL map. Rebuild
(`npm run build -w @sandbox-brain/core`). Both the app and the MCP server now
know the type. Mirror the row in `src/lib/database.types.ts` (hand-maintained
until `npm run db:types` regenerates it).

## 5. (Optional) UI route + events

- Add a page under `src/app/<type>/` with an `actions.ts` for writes.
- Call `emitEvent()` from every write action (verb vocabulary in
  `packages/core/src/events.ts`) so the type appears on the home feed and
  `brain_timeline`.
- Mount `<HistoryPanel objectType="..." objectId={...} />` on its detail page.
- Optionally add MCP tools in `mcp/src/tools/` (one file per domain) and
  emit via `emitMcpEvent()`.

## Verification

Create one row, then confirm: it appears in `select * from objects`; a `links`
row referencing it inserts cleanly; it shows on the graph and (if events are
wired) the home feed.
