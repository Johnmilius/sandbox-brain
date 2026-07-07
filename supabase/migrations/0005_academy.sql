-- =============================================================================
-- Sandbox Brain — Academy: curriculum modules, steps, progress, and outcomes
--
-- Apply via the Supabase dashboard SQL Editor (like 0001-0004), or `npm run db:push`.
--
-- The Academy turns the Sandbox bootcamp curriculum (docs/sandbox_academy_export.txt)
-- into first-class data: modules and steps the team works through, per-person
-- step completion, and the 20 founder Learning Outcomes with per-person
-- self-assessments. Seeded by `npm run seed:academy`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Modules (seeded courses/workshops + future custom modules)
-- -----------------------------------------------------------------------------

create table if not exists public.academy_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,           -- stable natural key for idempotent seeding
  title text not null,
  description text,
  kind text not null default 'course' check (kind in ('course', 'workshop', 'custom')),
  sort_order int not null unique,
  created_by uuid references public.profiles (id),  -- null = seeded curriculum
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored
);

create index if not exists academy_modules_search_idx
  on public.academy_modules using gin (search_document);

create trigger academy_modules_set_updated_at
  before update on public.academy_modules
  for each row execute function public.set_updated_at();

alter table public.academy_modules enable row level security;
create policy "team full access on academy_modules"
  on public.academy_modules for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Steps (each is a copy-paste prompt for chat or a coding agent, or a video)
-- -----------------------------------------------------------------------------

create table if not exists public.academy_steps (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_modules (id) on delete cascade,
  step_no int not null,
  title text not null,
  prompt_text text not null default '',
  step_type text not null default 'chat' check (step_type in ('chat', 'coding_agent', 'video')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, step_no),
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(prompt_text, ''))
  ) stored
);

create index if not exists academy_steps_search_idx
  on public.academy_steps using gin (search_document);
create index if not exists academy_steps_module_idx
  on public.academy_steps (module_id, step_no);

create trigger academy_steps_set_updated_at
  before update on public.academy_steps
  for each row execute function public.set_updated_at();

alter table public.academy_steps enable row level security;
create policy "team full access on academy_steps"
  on public.academy_steps for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Per-person step completion (row present = complete)
-- -----------------------------------------------------------------------------

create table if not exists public.academy_step_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  step_id uuid not null references public.academy_steps (id) on delete cascade,
  completed_at timestamptz not null default now(),
  notes text,
  unique (user_id, step_id)
);

create index if not exists academy_step_progress_user_idx
  on public.academy_step_progress (user_id);
create index if not exists academy_step_progress_step_idx
  on public.academy_step_progress (step_id);

alter table public.academy_step_progress enable row level security;
create policy "team full access on academy_step_progress"
  on public.academy_step_progress for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Learning outcomes (the ~20 founder competencies)
-- -----------------------------------------------------------------------------

create table if not exists public.academy_outcomes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists academy_outcomes_name_unique
  on public.academy_outcomes (lower(name));

alter table public.academy_outcomes enable row level security;
create policy "team full access on academy_outcomes"
  on public.academy_outcomes for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Module -> outcome mapping (which competencies a module trains)
-- -----------------------------------------------------------------------------

create table if not exists public.academy_module_outcomes (
  module_id uuid not null references public.academy_modules (id) on delete cascade,
  outcome_id uuid not null references public.academy_outcomes (id) on delete cascade,
  primary key (module_id, outcome_id)
);

create index if not exists academy_module_outcomes_outcome_idx
  on public.academy_module_outcomes (outcome_id);

alter table public.academy_module_outcomes enable row level security;
create policy "team full access on academy_module_outcomes"
  on public.academy_module_outcomes for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Per-person self-assessments (one current row per user+outcome, upserted)
-- rating: 1 Novice, 2 Developing, 3 Strong, 4 Advanced
-- -----------------------------------------------------------------------------

create table if not exists public.academy_outcome_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  outcome_id uuid not null references public.academy_outcomes (id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  confidence smallint check (confidence between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, outcome_id)
);

create index if not exists academy_outcome_assessments_outcome_idx
  on public.academy_outcome_assessments (outcome_id);

create trigger academy_outcome_assessments_set_updated_at
  before update on public.academy_outcome_assessments
  for each row execute function public.set_updated_at();

alter table public.academy_outcome_assessments enable row level security;
create policy "team full access on academy_outcome_assessments"
  on public.academy_outcome_assessments for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Widen the entity-type checks so links/taggables can reference academy
-- entities. (Column-level checks are auto-named <table>_<column>_check.)
-- 'academy_outcome' is allowed in links now so future "evidence" edges
-- (knowledge_item -> academy_outcome) need no further migration.
-- -----------------------------------------------------------------------------

alter table public.links drop constraint if exists links_source_type_check;
alter table public.links add constraint links_source_type_check
  check (source_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent',
                         'academy_module', 'academy_outcome'));

alter table public.links drop constraint if exists links_target_type_check;
alter table public.links add constraint links_target_type_check
  check (target_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent',
                         'academy_module', 'academy_outcome'));

alter table public.taggables drop constraint if exists taggables_entity_type_check;
alter table public.taggables add constraint taggables_entity_type_check
  check (entity_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'time_entry',
                         'agent', 'academy_module'));
