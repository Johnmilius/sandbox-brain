-- =============================================================================
-- Sandbox Brain — Roadmap Phase 1: the events timeline
-- (docs/vision/ROADMAP.md, Pillar 3 outbox + Pillar 4 organizational memory)
--
-- Append-only log of everything that happens: every app server action and
-- every MCP write tool emits one row. The home activity feed, per-object
-- History panels, and brain_timeline are all derived from this table —
-- the organizational timeline is never hand-maintained.
--
-- Design notes:
--   * verb is free text (vocabulary lives in packages/core) — growing the
--     vocabulary must not require DDL.
--   * object/target labels are denormalized at emit time so the feed renders
--     without joins and history survives deletions.
--   * project_id scopes the "my projects" feed filter.
--   * processed_at makes this table double as an outbox: future background
--     workers (embeddings, notifications, blast-radius notes) consume
--     unprocessed events — no separate queue infrastructure.
--   * Append-only: RLS grants select + insert-as-self only. Deliberately no
--     update/delete policies.
--
-- Apply via the Supabase dashboard SQL Editor, or `npm run db:push`.
-- =============================================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid() references public.profiles (id), -- null for system/connector events
  verb text not null,                              -- e.g. created/updated/completed/linked/logged_time
  object_type text not null references public.object_types (name),
  object_id uuid not null,
  object_label text,
  target_type text references public.object_types (name),
  target_id uuid,
  target_label text,
  project_id uuid references public.projects (id) on delete set null,
  source text not null default 'app' check (source in ('app', 'mcp', 'connector')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz                         -- outbox: null = not yet consumed
);

-- Feed: keyset pagination on (occurred_at, id).
create index if not exists events_feed_idx
  on public.events (occurred_at desc, id desc);
-- Per-object History panel.
create index if not exists events_object_idx
  on public.events (object_type, object_id, occurred_at desc);
-- Per-person timeline.
create index if not exists events_actor_idx
  on public.events (actor_id, occurred_at desc);
-- "My projects" feed filter.
create index if not exists events_project_idx
  on public.events (project_id, occurred_at desc)
  where project_id is not null;
-- Outbox scan for future workers.
create index if not exists events_unprocessed_idx
  on public.events (occurred_at)
  where processed_at is null;

alter table public.events enable row level security;

create policy "team can read events"
  on public.events for select
  to authenticated
  using (public.is_team_member());

-- Insert only as yourself. Connector/system events (actor_id null) are
-- written with the service role, which bypasses RLS.
create policy "team can record own events"
  on public.events for insert
  to authenticated
  with check (public.is_team_member() and actor_id = auth.uid());

-- No update/delete policies: the timeline is append-only for everyone
-- except the service role (used only for maintenance).
