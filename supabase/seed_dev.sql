-- =============================================================================
-- Sandbox Brain — DEV SEED (demo dataset for visualizing a live-like workspace)
--
-- WHAT IT DOES
--   Wipes the app CONTENT tables and repopulates them with a rich, realistic
--   team dataset: 3 people, 5 projects, ~20 tasks, ~50 time entries, notes with
--   wiki-links, prompts, ideas, agents, knowledge items, tags, and graph links.
--
-- WHAT IT DOES NOT TOUCH
--   auth.users / profiles / allowed_emails (except it may CREATE two synthetic
--   teammates so avatars/assignees have variety), and the academy_* tables
--   (those are seeded separately by `npm run seed:academy`).
--
-- HOW TO RUN
--   • Supabase dashboard → SQL Editor → paste this whole file → Run, OR
--   • psql "$DATABASE_URL" -f supabase/seed_dev.sql
--   Safe to re-run — it clears its own content first, so you always get a fresh
--   demo set. Requires migrations 0001–0007 already applied.
--
-- ⚠  This DELETES existing rows in: projects, tasks, time_entries, notes,
--    prompts, ideas, agents, knowledge_items, tags, taggables, links.
--    Run it on a dev/demo database, not one holding real work you care about.
-- =============================================================================

do $$
declare
  v_john  uuid;
  v_sam   uuid;
  v_alex  uuid;
  people  uuid[];
  projs   uuid[];

  v_ramp  uuid;
  v_side  uuid;
  v_ware  uuid;
  v_orbit uuid;
  v_field uuid;
begin
  -- ---------------------------------------------------------------------------
  -- 0. Clear existing app content (FK-safe order). Leaves people + academy.
  -- ---------------------------------------------------------------------------
  delete from public.links;
  delete from public.taggables;
  delete from public.time_entries;
  delete from public.tasks;
  delete from public.prompts;
  delete from public.agents;
  delete from public.knowledge_items;
  delete from public.ideas;
  delete from public.notes;
  delete from public.tags;
  delete from public.projects;

  -- ---------------------------------------------------------------------------
  -- 1. People. Prefer the real signed-in owner; create two synthetic teammates
  --    so the board/graph/time views show a real team. Best-effort — if the
  --    auth.users insert isn't permitted, we fall back to existing profiles.
  -- ---------------------------------------------------------------------------
  select id into v_john from public.profiles where email = 'jwmilius@gmail.com';

  begin
    if not exists (select 1 from public.profiles where email = 'sam@sandbox.test') then
      insert into auth.users
        (instance_id, id, aud, role, email, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values
        ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
         'authenticated', 'authenticated', 'sam@sandbox.test', now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"full_name":"Sam Chen"}'::jsonb, now(), now());
    end if;
    if not exists (select 1 from public.profiles where email = 'alex@sandbox.test') then
      insert into auth.users
        (instance_id, id, aud, role, email, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values
        ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
         'authenticated', 'authenticated', 'alex@sandbox.test', now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"full_name":"Alex Rivera"}'::jsonb, now(), now());
    end if;
    insert into public.allowed_emails (email)
      values ('sam@sandbox.test'), ('alex@sandbox.test')
      on conflict do nothing;
  exception when others then
    raise notice 'Skipped creating synthetic teammates (%). Using existing profiles.', sqlerrm;
  end;

  select id into v_sam  from public.profiles where email = 'sam@sandbox.test';
  select id into v_alex from public.profiles where email = 'alex@sandbox.test';

  -- Fallbacks so nothing is null even on a single-profile database.
  if v_john is null then
    select id into v_john from public.profiles order by created_at limit 1;
  end if;
  if v_john is null then
    raise exception 'No profiles exist yet — sign in once to create a profile, then re-run this seed.';
  end if;
  v_sam  := coalesce(v_sam,  v_john);
  v_alex := coalesce(v_alex, v_john);
  people := array[v_john, v_sam, v_alex];

  -- ---------------------------------------------------------------------------
  -- 2. Projects
  -- ---------------------------------------------------------------------------
  insert into public.projects (name, description, status, ticket_prefix, started_on, created_by, created_at)
  values ('Ramp landing', 'Marketing site + waitlist for the Ramp launch.', 'active', 'RMP', current_date - 40, v_john, now() - interval '40 days')
  returning id into v_ramp;

  insert into public.projects (name, description, status, ticket_prefix, started_on, created_by, created_at)
  values ('Sidequest v2', 'Second pass at the Sidequest companion app.', 'active', 'SQ', current_date - 30, v_sam, now() - interval '30 days')
  returning id into v_side;

  insert into public.projects (name, description, status, ticket_prefix, started_on, created_by, created_at)
  values ('Warehouse sim', 'Physics sandbox for warehouse throughput modeling.', 'active', 'WH', current_date - 22, v_alex, now() - interval '22 days')
  returning id into v_ware;

  insert into public.projects (name, description, status, ticket_prefix, started_on, created_by, created_at)
  values ('Orbit CRM', 'Lightweight CRM experiment — paused pending research.', 'paused', 'ORB', current_date - 60, v_john, now() - interval '60 days')
  returning id into v_orbit;

  insert into public.projects (name, description, status, ticket_prefix, started_on, ended_on, created_by, created_at)
  values ('Field Notes', 'Shipped: mobile capture app for field research.', 'completed', 'FN', current_date - 90, current_date - 10, v_sam, now() - interval '90 days')
  returning id into v_field;

  projs := array[v_ramp, v_side, v_ware, v_orbit, v_field];

  -- ---------------------------------------------------------------------------
  -- 3. Notes (unique titles; bodies use [[wiki-links]] to real titles)
  -- ---------------------------------------------------------------------------
  insert into public.notes (author_id, title, body, created_at, updated_at) values
    (v_john, 'Positioning v3',
     E'Our wedge is speed-to-value. See [[Growth loops]] for the acquisition side and [[Ramp launch plan]] for sequencing.\n\nMessage: "Ship the brain, not the busywork."',
     now() - interval '9 days', now() - interval '14 minutes'),
    (v_sam, 'Growth loops',
     E'Three loops we can actually run: referral, content, and integration.\n\nContent loop feeds [[Positioning v3]].',
     now() - interval '8 days', now() - interval '2 hours'),
    (v_alex, 'Onboarding idea',
     E'First-run should reach a populated workspace in under 60s. Ties into [[Growth loops]] activation.',
     now() - interval '6 days', now() - interval '1 day'),
    (v_john, 'Ramp launch plan',
     E'T-minus checklist for launch week. Depends on [[Positioning v3]] being locked.',
     now() - interval '5 days', now() - interval '3 hours'),
    (v_sam, 'Brand voice',
     E'Plain, warm, a little wry. No hype words. Editorial, not corporate.',
     now() - interval '7 days', now() - interval '2 days'),
    (v_alex, 'Warehouse sim architecture',
     E'Deterministic step loop at 33ms. Entities are plain structs; systems mutate arrays.',
     now() - interval '4 days', now() - interval '5 hours'),
    (v_john, 'Stack decisions',
     E'Next.js + Supabase + Postgres. Rationale captured in [[Warehouse sim architecture]] for the sim-specific bits.',
     now() - interval '11 days', now() - interval '4 days'),
    (v_sam, 'Customer interviews Q3',
     E'Eight calls. Recurring pain: context lost between tools. Validates [[Onboarding idea]].',
     now() - interval '3 days', now() - interval '20 hours');

  insert into public.links (source_type, source_id, target_type, target_id, relationship, created_by)
  select 'note', s.id, 'note', t.id, 'wiki', v_john
  from (values
    ('Positioning v3','Growth loops'),
    ('Positioning v3','Ramp launch plan'),
    ('Growth loops','Positioning v3'),
    ('Onboarding idea','Growth loops'),
    ('Ramp launch plan','Positioning v3'),
    ('Stack decisions','Warehouse sim architecture'),
    ('Customer interviews Q3','Onboarding idea')
  ) as w(src, tgt)
  join public.notes s on lower(s.title) = lower(w.src)
  join public.notes t on lower(t.title) = lower(w.tgt)
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- 4. Prompts
  -- ---------------------------------------------------------------------------
  insert into public.prompts (user_id, project_id, title, prompt_text, response_notes, ai_tool, rating, is_favorite, created_at) values
    (v_john, v_ramp, 'Landing hero rewrite',
     'Rewrite this hero section to lead with the outcome, not the feature. Keep it under 12 words. Voice: plain, warm, a little wry.',
     'Nailed it on the second try.', 'claude', 5, true, now() - interval '6 days'),
    (v_sam, v_side, 'Cold email opener',
     'Write 3 cold-email openers for a busy founder. No flattery, no "hope this finds you well". Get to the point in one sentence.',
     'Opener #2 got a reply.', 'chatgpt', 4, true, now() - interval '5 days'),
    (v_alex, v_ware, 'Physics debug helper',
     'Given this step loop, explain why entities drift after ~500 frames and propose a fix. Reason step by step.',
     'Found the accumulation bug.', 'claude-code', 5, false, now() - interval '4 days'),
    (v_john, v_ramp, 'Meta description generator',
     'Generate a 155-char meta description for this page that includes the primary keyword naturally.',
     null, 'claude', 3, false, now() - interval '8 days'),
    (v_sam, null, 'PR review checklist',
     'Act as a senior reviewer. Check this diff for correctness, naming, and dead code. Be terse. List findings by severity.',
     'Solid default reviewer.', 'claude-code', 4, true, now() - interval '3 days'),
    (v_alex, v_field, 'Release notes from commits',
     'Turn these commit messages into user-facing release notes grouped by theme. Skip internal refactors.',
     null, 'chatgpt', 4, false, now() - interval '12 days'),
    (v_john, v_side, 'Onboarding copy pass',
     'Tighten this onboarding flow copy. Every screen should earn its place. Cut anything that reads like a tooltip.',
     'Cut two screens entirely.', 'claude', 5, false, now() - interval '2 days'),
    (v_sam, v_ware, 'Test writer',
     'Write vitest tests for this pure function covering edge cases and one property-based check.',
     null, 'cursor', 3, false, now() - interval '7 days');

  -- ---------------------------------------------------------------------------
  -- 5. Ideas (lean-canvas + 7-dimension scores; one promoted to a project)
  -- ---------------------------------------------------------------------------
  insert into public.ideas
    (title, tagline, problem, customer, solution, revenue_model, stack_notes,
     verdict, status, scores, source_url, promoted_project_id, created_by, created_at, updated_at)
  values
    ('Coldset', 'Warm intros on autopilot', 'Cold outreach is slow and low-converting.', 'Early-stage founders', 'Mine your network graph for the warmest path to any target.', 'Per-seat SaaS', 'Graph DB + email integrations.',
     'strong', 'promoted',
     '{"problem":5,"market":4,"revenue":4,"moat":3,"distribution":4,"build":3,"team_fit":5}'::jsonb,
     'https://example.com/coldset-memo', v_ramp, v_john, now() - interval '20 days', now() - interval '2 days'),

    ('Warehouse Copilot', 'Ops assistant for the floor', 'Floor managers juggle five dashboards.', 'Mid-size 3PLs', 'One assistant that reads every system and answers in plain language.', 'Usage-based', 'LLM + existing WMS APIs.',
     'conditional', 'validating',
     '{"problem":4,"market":4,"revenue":3,"moat":2,"distribution":3,"build":2,"team_fit":4}'::jsonb,
     null, null, v_alex, now() - interval '14 days', now() - interval '1 day'),

    ('Streaklet', 'Habit streaks for teams', 'Team habits fade without visible momentum.', 'Small remote teams', 'Lightweight shared streaks tied to real activity.', 'Freemium', 'Simple; ship on the current stack.',
     null, 'draft',
     '{"problem":3,"market":2,"build":4}'::jsonb,
     null, null, v_sam, now() - interval '9 days', now() - interval '9 days'),

    ('Merge Warden', 'Stop merge conflicts before they start', 'Two devs edit the same area and collide.', 'Dev teams of 3-10', 'Claim + conflict detection surfaced in the task board.', 'Per-seat', 'Reuses the tasks claim/lock model.',
     'conditional', 'validating',
     '{"problem":5,"market":3,"revenue":2,"moat":3,"distribution":2,"build":4,"team_fit":5}'::jsonb,
     null, null, v_john, now() - interval '6 days', now() - interval '10 hours'),

    ('Campus', 'Founder curriculum, on demand', 'Learning is scattered across bookmarks.', 'First-time founders', 'A structured path with real prompts and outcomes.', 'Cohort + subscription', 'Content-heavy.',
     'pass', 'archived',
     '{"problem":3,"market":2,"revenue":2,"moat":1,"distribution":2,"build":3,"team_fit":3}'::jsonb,
     'https://example.com/campus', null, v_sam, now() - interval '25 days', now() - interval '18 days'),

    ('Fieldbook', 'Offline-first research capture', 'Field notes get lost before sync.', 'Field researchers', 'Capture offline, reconcile on reconnect, link into the brain.', 'One-time + support', 'Local-first sync engine.',
     'strong', 'validating',
     '{"problem":4,"market":3,"revenue":3,"moat":4,"distribution":3,"build":3,"team_fit":4}'::jsonb,
     null, null, v_alex, now() - interval '4 days', now() - interval '6 hours');

  insert into public.links (source_type, source_id, target_type, target_id, relationship, created_by)
  select 'idea', i.id, 'project', v_ramp, 'promoted', v_john
  from public.ideas i where i.title = 'Coldset'
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- 6. Agents (tools[] + system prompt; linked to the prompts they use)
  -- ---------------------------------------------------------------------------
  insert into public.agents (name, description, system_prompt, model, tools, status, project_id, created_by, created_at) values
    ('Code Reviewer', 'Terse senior reviewer for pull requests.',
     'You are a senior engineer. Review diffs for correctness, naming, and dead code. Be terse. List findings by severity, most severe first.',
     'claude-opus-4-8', '{GitHub,ESLint,"repo read"}', 'active', v_ramp, v_john, now() - interval '10 days'),
    ('Test Writer', 'Writes focused vitest suites for pure functions.',
     'Given a function, write vitest tests covering edge cases plus one property-based check. No snapshot tests.',
     'claude-sonnet-5', '{vitest,"repo read","repo write"}', 'active', v_ware, v_alex, now() - interval '8 days'),
    ('Frontend Scaffolder', 'Generates styled components matching the design system.',
     'Scaffold React components using the project tokens and Tailwind. Match existing patterns. Never introduce raw hex where a CSS var exists.',
     'claude-sonnet-5', '{React,Tailwind,"repo write"}', 'active', v_side, v_sam, now() - interval '6 days'),
    ('Bug Triager', 'Reproduces and classifies incoming bug reports.',
     'Reproduce the reported bug, isolate the smallest failing case, and classify severity and area.',
     'claude-haiku-4-5', '{"repo read",logs,"issue tracker"}', 'active', null, v_john, now() - interval '4 days'),
    ('Prompt Curator', 'Keeps the prompt library deduped and rated.',
     'Scan the prompt library weekly. Flag duplicates and stale prompts. Suggest a canonical favorite per task.',
     'claude-haiku-4-5', '{"repo read"}', 'archived', null, v_sam, now() - interval '15 days');

  insert into public.links (source_type, source_id, target_type, target_id, relationship, created_by)
  select 'agent', a.id, 'prompt', p.id, 'uses', v_john
  from (values
    ('Code Reviewer','PR review checklist'),
    ('Test Writer','Test writer'),
    ('Frontend Scaffolder','Onboarding copy pass')
  ) as m(agent, prompt)
  join public.agents a on a.name = m.agent
  join public.prompts p on p.title = m.prompt
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- 7. Knowledge items (the Brain — mixed kinds with kind-specific data)
  -- ---------------------------------------------------------------------------
  insert into public.knowledge_items (kind, title, description, content, data, url, project_id, created_by, created_at) values
    ('decision', 'Why Supabase over Firebase', 'Postgres + RLS + SQL access won.',
     'We chose Supabase for relational data, row-level security, and raw SQL. Firebase''s query model didn''t fit the graph.',
     '{"outcome":"worked"}'::jsonb, null, v_ramp, v_john, now() - interval '18 days'),
    ('code_snippet', 'Local-date day bucketing', 'Never use toISOString() for day math.',
     E'const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;',
     '{"language":"typescript"}'::jsonb, null, v_ware, v_alex, now() - interval '12 days'),
    ('document', 'Launch runbook', 'Step-by-step for launch day.',
     'Freeze main, run smoke tests, flip the flag, watch logs for 30 min, post in #launch.',
     '{}'::jsonb, 'https://example.com/runbook', v_ramp, v_john, now() - interval '5 days'),
    ('contact', 'Priya — design partner', 'Warm intro from the Coldset memo.',
     'Runs ops at a mid-size 3PL. Happy to test Warehouse Copilot.',
     '{"contact_type":"design partner","contact_info":"priya@example.com"}'::jsonb, null, v_ware, v_alex, now() - interval '7 days'),
    ('decision', 'Timer = stop+restart', 'Pause is modeled without a schema change.',
     'Pausing stops the entry and starts a new one on resume. Keeps one-running-timer invariant intact.',
     '{"outcome":"worked"}'::jsonb, null, null, v_sam, now() - interval '9 days'),
    ('code_snippet', 'Wiki-link regex', 'Parses [[Title]] into links.',
     'const WIKI = /\\[\\[([^\\]]+)\\]\\]/g;',
     '{"language":"typescript"}'::jsonb, null, null, v_john, now() - interval '11 days'),
    ('document', 'Brand voice guide', 'The one-pager on how we write.',
     'Plain, warm, a little wry. No hype. Prefer verbs. Cut adverbs.',
     '{}'::jsonb, null, v_ramp, v_sam, now() - interval '6 days'),
    ('decision', 'Dropped the 14-day chart', 'Kept behind a details toggle for now.',
     'The V2 week view replaced it; the longer window is secondary. Revisit after launch.',
     '{"outcome":"mixed"}'::jsonb, null, v_field, v_alex, now() - interval '3 days');

  -- ---------------------------------------------------------------------------
  -- 8. Tags + taggables (drives colored tags + soft graph edges)
  -- ---------------------------------------------------------------------------
  insert into public.tags (name) values
    ('marketing'), ('strategy'), ('product'), ('design'),
    ('backend'), ('frontend'), ('launch'), ('research'),
    ('growth'), ('infra')
  on conflict do nothing;

  -- Tag a spread of entities by title so the graph clusters meaningfully.
  insert into public.taggables (tag_id, entity_type, entity_id)
  select tg.id, 'note', n.id
  from (values
    ('Positioning v3','marketing'), ('Growth loops','growth'),
    ('Onboarding idea','product'), ('Ramp launch plan','launch'),
    ('Brand voice','marketing'), ('Warehouse sim architecture','backend'),
    ('Stack decisions','infra'), ('Customer interviews Q3','research')
  ) as m(title, tag)
  join public.notes n on lower(n.title) = lower(m.title)
  join public.tags tg on tg.name = m.tag
  on conflict do nothing;

  insert into public.taggables (tag_id, entity_type, entity_id)
  select tg.id, 'idea', i.id
  from (values
    ('Coldset','growth'), ('Warehouse Copilot','product'),
    ('Merge Warden','product'), ('Fieldbook','research')
  ) as m(title, tag)
  join public.ideas i on i.title = m.title
  join public.tags tg on tg.name = m.tag
  on conflict do nothing;

  insert into public.taggables (tag_id, entity_type, entity_id)
  select tg.id, 'prompt', p.id
  from (values
    ('Landing hero rewrite','marketing'), ('Cold email opener','growth'),
    ('PR review checklist','backend'), ('Onboarding copy pass','product')
  ) as m(title, tag)
  join public.prompts p on p.title = m.title
  join public.tags tg on tg.name = m.tag
  on conflict do nothing;

  insert into public.taggables (tag_id, entity_type, entity_id)
  select tg.id, 'project', pr.id
  from (values
    ('Ramp landing','launch'), ('Sidequest v2','product'),
    ('Warehouse sim','backend')
  ) as m(name, tag)
  join public.projects pr on pr.name = m.name
  join public.tags tg on tg.name = m.tag
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- 9. Tasks (per-project ticket_num; mixed status/priority/area; a few claimed;
  --    two Ramp/frontend/inprogress tickets create a live conflict flag)
  -- ---------------------------------------------------------------------------
  insert into public.tasks (project_id, ticket_num, title, description, priority, area, status, assignee, claimed_by, checklist, created_by, created_at) values
    -- Ramp landing (RMP)
    (v_ramp, 14, 'Hero section responsive layout', 'Make the hero stack cleanly on mobile.', 'high', 'frontend', 'inprogress', v_john, v_john,
     '[{"text":"Desktop breakpoint","done":true},{"text":"Tablet breakpoint","done":true},{"text":"Mobile breakpoint","done":false}]'::jsonb, v_john, now() - interval '3 days'),
    (v_ramp, 15, 'Waitlist form validation', 'Inline errors + success state.', 'med', 'frontend', 'inprogress', v_sam, v_sam,
     '[{"text":"Email regex","done":true},{"text":"Success toast","done":false}]'::jsonb, v_sam, now() - interval '2 days'),
    (v_ramp, 16, 'Meta tags + OG images', 'Social preview cards.', 'low', 'copy', 'todo', v_john, null,
     '[]'::jsonb, v_john, now() - interval '4 days'),
    (v_ramp, 17, 'Analytics wiring', 'Hook up page + conversion events.', 'med', 'backend', 'backlog', null, null,
     '[]'::jsonb, v_john, now() - interval '5 days'),
    (v_ramp, 18, 'Launch copy final pass', 'Lock headline + subhead.', 'high', 'copy', 'review', v_sam, v_sam,
     '[{"text":"Headline","done":true},{"text":"Subhead","done":true},{"text":"CTA","done":false}]'::jsonb, v_john, now() - interval '1 day'),
    (v_ramp, 19, 'Deploy preview to staging', 'Ship to staging for review.', 'low', 'backend', 'done', v_alex, null,
     '[{"text":"Build green","done":true},{"text":"Smoke test","done":true}]'::jsonb, v_alex, now() - interval '6 days'),
    -- Sidequest v2 (SQ)
    (v_side, 31, 'Companion sync engine', 'Local-first sync with conflict resolution.', 'high', 'backend', 'inprogress', v_alex, v_alex,
     '[{"text":"Queue design","done":true},{"text":"Reconcile pass","done":false}]'::jsonb, v_alex, now() - interval '3 days'),
    (v_side, 32, 'Onboarding screens', 'Three-screen first-run flow.', 'med', 'design', 'todo', v_sam, null,
     '[]'::jsonb, v_sam, now() - interval '2 days'),
    (v_side, 33, 'Settings redesign', 'Group settings, add search.', 'low', 'frontend', 'backlog', null, null,
     '[]'::jsonb, v_sam, now() - interval '4 days'),
    (v_side, 34, 'Push notification opt-in', 'Ask at the right moment, not on launch.', 'med', 'frontend', 'review', v_john, v_john,
     '[{"text":"Timing logic","done":true}]'::jsonb, v_john, now() - interval '1 day'),
    (v_side, 35, 'Crash reporting', 'Wire up error reporting SDK.', 'high', 'backend', 'done', v_alex, null,
     '[{"text":"SDK added","done":true},{"text":"Verified in staging","done":true}]'::jsonb, v_alex, now() - interval '7 days'),
    -- Warehouse sim (WH)
    (v_ware, 11, 'Fix entity drift after 500 frames', 'Accumulation error in the step loop.', 'high', 'backend', 'inprogress', v_alex, v_alex,
     '[{"text":"Reproduce","done":true},{"text":"Patch accumulator","done":false}]'::jsonb, v_alex, now() - interval '2 days'),
    (v_ware, 12, 'Throughput heatmap overlay', 'Visualize bottlenecks on the grid.', 'med', 'frontend', 'todo', v_john, null,
     '[]'::jsonb, v_alex, now() - interval '3 days'),
    (v_ware, 13, 'Deterministic seed replay', 'Same seed = same run for tests.', 'med', 'backend', 'backlog', null, null,
     '[]'::jsonb, v_alex, now() - interval '5 days'),
    (v_ware, 14, 'Perf pass on render', 'Batch draws; target 60fps.', 'low', 'frontend', 'review', v_sam, v_sam,
     '[{"text":"Profile","done":true},{"text":"Batch draw calls","done":true}]'::jsonb, v_alex, now() - interval '1 day'),
    -- Orbit CRM (ORB) — paused project, a couple of parked tickets
    (v_orbit, 4, 'Contact import CSV', 'Map arbitrary CSV columns.', 'low', 'backend', 'backlog', null, null,
     '[]'::jsonb, v_john, now() - interval '30 days'),
    (v_orbit, 5, 'Pipeline board', 'Drag deals across stages.', 'med', 'frontend', 'todo', v_john, null,
     '[]'::jsonb, v_john, now() - interval '28 days'),
    -- Field Notes (FN) — completed project, all done
    (v_field, 21, 'Offline capture', 'Write locally, sync later.', 'high', 'backend', 'done', v_sam, null,
     '[{"text":"Local store","done":true},{"text":"Sync","done":true}]'::jsonb, v_sam, now() - interval '40 days'),
    (v_field, 22, 'Photo attachments', 'Attach + compress images.', 'med', 'frontend', 'done', v_alex, null,
     '[{"text":"Picker","done":true},{"text":"Compression","done":true}]'::jsonb, v_sam, now() - interval '35 days'),
    (v_field, 23, 'Export to brain', 'Push notes into the knowledge base.', 'low', 'backend', 'done', v_john, null,
     '[{"text":"Mapping","done":true}]'::jsonb, v_sam, now() - interval '20 days');

  -- ---------------------------------------------------------------------------
  -- 10. Time entries. ~50 completed sessions over the last 14 days across the
  --     team + projects, plus one live running timer for the owner.
  -- ---------------------------------------------------------------------------
  insert into public.time_entries (user_id, project_id, started_at, ended_at, notes, source)
  select
    (array[v_john, v_sam, v_alex])[1 + floor(random() * 3)::int],
    (array[v_ramp, v_side, v_ware])[1 + floor(random() * 3)::int],  -- the 3 active projects
    ts,
    ts + make_interval(mins => (30 + floor(random() * 165))::int),
    (array['Deep work','Pairing session','Bugfix','Review','Planning','Refactor', null])[1 + floor(random() * 7)::int],
    (array['timer','manual'])[1 + floor(random() * 2)::int]
  from (
    select date_trunc('day', now())
             - make_interval(days => d)
             + make_interval(hours => (9 + floor(random() * 8))::int, mins => floor(random() * 60)::int) as ts
    from generate_series(0, 13) as d,
         generate_series(1, 5) as n   -- up to 5 candidate sessions per day
  ) g
  where random() < 0.72;               -- ~50 sessions after filtering

  -- One live running timer for the owner (ended_at null → shows in the sidebar chip).
  insert into public.time_entries (user_id, project_id, started_at, ended_at, source)
  values (v_john, v_ramp, now() - interval '38 minutes', null, 'timer');

  raise notice 'Sandbox Brain dev seed complete: 5 projects, 20 tasks, notes/prompts/ideas/agents/knowledge, ~50 time entries.';
end $$;
