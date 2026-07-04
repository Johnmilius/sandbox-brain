-- =============================================================================
-- Sandbox Brain — Phase 1: core schema + Row Level Security
--
-- Apply via the Supabase dashboard SQL Editor (paste + run), or with the CLI:
--   npx supabase link --project-ref <your-project-ref>
--   npm run db:push
--
-- BEFORE APPLYING: add your two teammates' emails to the allowed_emails seed
-- at the bottom of this file (and keep ALLOWED_EMAILS in .env.local in sync).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Auto-maintain updated_at columns.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Team allowlist (database-level gate; mirrors ALLOWED_EMAILS in the app env)
-- -----------------------------------------------------------------------------

create table public.allowed_emails (
  email text primary key check (email = lower(email))
);

alter table public.allowed_emails enable row level security;

-- True when the signed-in user's email is on the team allowlist.
-- SECURITY DEFINER so it can read allowed_emails regardless of RLS.
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create policy "team can read allowlist"
  on public.allowed_emails for select
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Profiles (mirrors auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "team full access on profiles"
  on public.profiles for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Create/refresh a profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Projects (the companies/projects we work on)
-- -----------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  started_on date,
  ended_on date,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored
);

create index projects_search_idx on public.projects using gin (search_document);
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
create policy "team full access on projects"
  on public.projects for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Time entries (timer + manual backfill)
-- -----------------------------------------------------------------------------

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,          -- null while a timer is running
  notes text,
  source text not null default 'manual' check (source in ('timer', 'manual')),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

-- At most one running timer per person.
create unique index time_entries_one_running_timer
  on public.time_entries (user_id)
  where ended_at is null;

create index time_entries_project_idx on public.time_entries (project_id);
create index time_entries_user_idx on public.time_entries (user_id, started_at desc);

alter table public.time_entries enable row level security;
create policy "team full access on time_entries"
  on public.time_entries for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Prompts (the AI prompt database)
-- -----------------------------------------------------------------------------

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id),
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  prompt_text text not null,
  response_notes text,           -- what came back / what worked or didn't
  ai_tool text,                  -- e.g. 'claude', 'chatgpt', 'cursor', 'claude-code'
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(prompt_text, '') || ' ' ||
      coalesce(response_notes, '') || ' ' ||
      coalesce(ai_tool, ''))
  ) stored
);

create index prompts_search_idx on public.prompts using gin (search_document);
create index prompts_project_idx on public.prompts (project_id);
create trigger prompts_set_updated_at
  before update on public.prompts
  for each row execute function public.set_updated_at();

alter table public.prompts enable row level security;
create policy "team full access on prompts"
  on public.prompts for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Notes (markdown with [[wiki-links]])
-- -----------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored
);

-- Wiki-links resolve by title, so titles must be unique (case-insensitive).
create unique index notes_title_unique on public.notes (lower(title));
create index notes_search_idx on public.notes using gin (search_document);
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
create policy "team full access on notes"
  on public.notes for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Knowledge items (the Brain: snippets, decisions, docs, contacts, archives)
-- -----------------------------------------------------------------------------

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in
    ('code_snippet', 'decision', 'document', 'contact', 'project_archive')),
  title text not null,
  description text,
  content text,                  -- code, decision write-up, contact notes, etc.
  data jsonb not null default '{}'::jsonb, -- kind-specific extras (language, outcome, contact info, repo URL)
  url text,                      -- external link (GitHub repo, doc URL, ...)
  file_path text,                -- Supabase Storage path for uploads
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(content, ''))
  ) stored
);

create index knowledge_items_search_idx on public.knowledge_items using gin (search_document);
create index knowledge_items_kind_idx on public.knowledge_items (kind);
create index knowledge_items_project_idx on public.knowledge_items (project_id);
create trigger knowledge_items_set_updated_at
  before update on public.knowledge_items
  for each row execute function public.set_updated_at();

alter table public.knowledge_items enable row level security;
create policy "team full access on knowledge_items"
  on public.knowledge_items for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Tags (shared across every entity type)
-- -----------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index tags_name_unique on public.tags (lower(name));

alter table public.tags enable row level security;
create policy "team full access on tags"
  on public.tags for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Entity types that tags and links may point at.
-- 'profile' lets the graph include people.
create table public.taggables (
  tag_id uuid not null references public.tags (id) on delete cascade,
  entity_type text not null check (entity_type in
    ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'time_entry')),
  entity_id uuid not null,
  primary key (tag_id, entity_type, entity_id)
);

create index taggables_entity_idx on public.taggables (entity_type, entity_id);

alter table public.taggables enable row level security;
create policy "team full access on taggables"
  on public.taggables for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Links (graph edges between any two entities)
-- Populated from explicit relations and from parsed [[wiki-links]] in notes.
-- -----------------------------------------------------------------------------

create table public.links (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in
    ('project', 'prompt', 'note', 'knowledge_item', 'profile')),
  source_id uuid not null,
  target_type text not null check (target_type in
    ('project', 'prompt', 'note', 'knowledge_item', 'profile')),
  target_id uuid not null,
  relationship text not null default 'related',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id, relationship)
);

create index links_source_idx on public.links (source_type, source_id);
create index links_target_idx on public.links (target_type, target_id);

alter table public.links enable row level security;
create policy "team full access on links"
  on public.links for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Seed: the team allowlist
-- TODO: replace the placeholders with your teammates' real Gmail addresses
-- (and keep ALLOWED_EMAILS in .env.local / Vercel in sync).
-- -----------------------------------------------------------------------------

insert into public.allowed_emails (email) values
  ('jwmilius@gmail.com')
  -- , ('teammate2@gmail.com')
  -- , ('teammate3@gmail.com')
on conflict do nothing;
