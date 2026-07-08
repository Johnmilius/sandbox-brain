-- =============================================================================
-- Ideas — early-stage startup idea drafts (lean-canvas style), searchable and
-- linkable, with a lightweight "promote to project" path once validated.
-- =============================================================================

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tagline text,
  problem text,
  customer text,
  solution text,
  revenue_model text,
  stack_notes text,
  verdict text check (verdict in ('strong', 'conditional', 'pass')),
  status text not null default 'draft'
    check (status in ('draft', 'validating', 'promoted', 'archived')),
  scores jsonb not null default '{}'::jsonb, -- {problem, market, revenue, moat, distribution, build, team_fit}
  source_url text, -- e.g. the doc/article this idea originated from
  promoted_project_id uuid references public.projects (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(tagline, '') || ' ' ||
      coalesce(problem, '') || ' ' ||
      coalesce(customer, '') || ' ' ||
      coalesce(solution, ''))
  ) stored
);

create index ideas_search_idx on public.ideas using gin (search_document);
create index ideas_status_idx on public.ideas (status);
create trigger ideas_set_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

alter table public.ideas enable row level security;
create policy "team full access on ideas"
  on public.ideas for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Ranks other ideas by full-text similarity to the given idea's own fields.
-- Simple, dependency-free stand-in for embeddings-based similarity search.
create or replace function public.find_similar_ideas(p_idea_id uuid, p_limit int default 5)
returns table (
  id uuid,
  title text,
  tagline text,
  verdict text,
  status text,
  rank real
)
language sql
stable
as $$
  select o.id, o.title, o.tagline, o.verdict, o.status,
         ts_rank(o.search_document, plainto_tsquery('english', s.combined_text)) as rank
  from public.ideas o
  cross join (
    select coalesce(title, '') || ' ' || coalesce(tagline, '') || ' ' ||
           coalesce(problem, '') || ' ' || coalesce(customer, '') || ' ' ||
           coalesce(solution, '') as combined_text
    from public.ideas
    where id = p_idea_id
  ) s
  where o.id != p_idea_id
    and ts_rank(o.search_document, plainto_tsquery('english', s.combined_text)) > 0
  order by rank desc
  limit p_limit;
$$;

-- Widen the entity-type checks so links/taggables can reference ideas.
-- (Column-level checks are auto-named <table>_<column>_check.)

alter table public.links drop constraint if exists links_source_type_check;
alter table public.links add constraint links_source_type_check
  check (source_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent',
                          'academy_module', 'academy_outcome', 'idea'));

alter table public.links drop constraint if exists links_target_type_check;
alter table public.links add constraint links_target_type_check
  check (target_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent',
                          'academy_module', 'academy_outcome', 'idea'));

alter table public.taggables drop constraint if exists taggables_entity_type_check;
alter table public.taggables add constraint taggables_entity_type_check
  check (entity_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'time_entry',
                          'agent', 'idea'));
