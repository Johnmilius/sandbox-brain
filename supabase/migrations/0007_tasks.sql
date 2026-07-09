-- Sandbox Brain — V2: Tasks (tickets with claiming + per-project prefixes)
alter table public.projects
  add column if not exists ticket_prefix text;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  ticket_num integer not null,
  title text not null,
  description text,
  priority text not null default 'med' check (priority in ('high', 'med', 'low')),
  area text not null default 'frontend' check (area in ('frontend', 'backend', 'design', 'copy')),
  status text not null default 'backlog'
    check (status in ('backlog', 'todo', 'inprogress', 'review', 'done')),
  assignee uuid references public.profiles (id) on delete set null,
  claimed_by uuid references public.profiles (id) on delete set null,
  checklist jsonb not null default '[]',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, ticket_num),
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored
);

create index if not exists tasks_search_idx on public.tasks using gin (search_document);
create index if not exists tasks_project_idx on public.tasks (project_id, status);
create index if not exists tasks_assignee_idx on public.tasks (assignee) where status <> 'done';

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
create policy "team full access on tasks"
  on public.tasks for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Widen entity checks so links/taggables can reference tasks (pattern from
-- 0004/0005/0006). Lists mirror 0006 exactly, plus 'task'.
alter table public.links drop constraint if exists links_source_type_check;
alter table public.links add constraint links_source_type_check
  check (source_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent',
                          'academy_module', 'academy_outcome', 'idea', 'task'));

alter table public.links drop constraint if exists links_target_type_check;
alter table public.links add constraint links_target_type_check
  check (target_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent',
                          'academy_module', 'academy_outcome', 'idea', 'task'));

alter table public.taggables drop constraint if exists taggables_entity_type_check;
alter table public.taggables add constraint taggables_entity_type_check
  check (entity_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'time_entry',
                          'agent', 'idea', 'task'));
