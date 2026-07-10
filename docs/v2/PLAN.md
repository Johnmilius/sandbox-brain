# Sandbox Brain V2 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the sandbox-brain frontend to the teammate's V2 "editorial workspace" design: new shell (sidebar + topbar + live timer chip), cream/serif design language across all existing pages, a new Home digest, and a new Tasks feature (kanban board, claiming, conflict detection).

**Architecture:** Design tokens land as CSS custom properties that REMAP the existing shadcn variable system in `src/app/globals.css` (so shadcn/ui components inherit V2 automatically), plus a small set of new `--v2-*` vars for extras. A new sidebar shell replaces the top-nav `app-header.tsx` via the root layout. Page restyles are skin-level (server components keep their queries/actions). Tasks is the only new backend surface: one additive migration (`0007_tasks.sql`), pure tested helpers in `src/lib/tasks.ts`, server actions, and board/list/drawer UI following the house patterns from Projects/Ideas.

**Tech Stack:** Next.js App Router + TS + Tailwind v4 + shadcn/ui (existing), next/font/google (Geist, Geist Mono, Newsreader), Vitest (new devDep, root) for lib tests, Docker postgres:17 for migration validation, Playwright MCP for visual verification.

**REQUIREMENTS SOURCE:** The extracted design spec at
`C:\Users\lukeb\AppData\Local\Temp\claude\C--Users-lukeb\f46bc484-ae1b-4c01-9d2e-d7e2d45c4175\scratchpad\v2-design\DESIGN-SPEC.md`
is the single source of design truth. Task briefs cite exact section numbers (§1.1 tokens, §2 shell, §3.x per-screen, §4 tasks model). Implementers MUST read the cited sections. Raw design HTML (for disambiguation only): same folder, `Sandbox Brain.dc.html` / `Sandbox Brain Ideas.dc.html`.

## Global Constraints

- Branch: `feature/v2-frontend` off current `main` (a127f41 or later). Never commit to main.
- NEVER add a Co-Authored-By trailer or any AI attribution to any commit message.
- Do NOT touch `mcp/`, `mcp-app/`, or existing migrations 0001–0006. Migration 0007 is additive only (new table + widened check constraints + one new column on `projects`).
- NEVER run migrations against the production Supabase (the keys in `.env.local` are live). Migration validation happens in a local Docker postgres only.
- Light-mode only (spec §1.6: the design defines no dark mode). Remove nothing dark-mode-related from shadcn's generated CSS; just don't add `.dark` V2 values. Document in PR.
- All commits conventional style. Dev server: `npm run dev` (repo root, port 3000).
- Verification of visual tasks = Playwright screenshots reviewed by the controller, NOT subagent self-assessment alone. A signed-in session is required (Luke signs in via Google once in the Playwright browser — controller coordinates; see Task 2 Step 6).

## Adjudicated Ambiguities (spec §5 — these decisions are FINAL for this plan)

1. Nav order (spec #1): Home, Projects, Ideas, Tasks, Time, Prompts, Agents, Notes, Brain, Graph, Academy, Growth. Academy gets shell+tokens only (no bespoke design exists, spec #10). Growth — REAL per Luke 2026-07-08: the design's funnel layout wired to live pipeline data (Captured = ideas count, Validating = ideas in validating stage, Building = active projects + inprogress tasks, Shipped = completed projects + done tasks this month) plus a weekly team-hours trend line from time_entries. Keep the design's visual language; drop the DRAFT badge; note in the PR that the growth lead should evolve the metric definitions. Implemented as Task 7b.
2. Icons: map design glyphs → lucide-react (already a dep): Home→`House`, Projects→`LayoutGrid`, Ideas→`Lightbulb`, Tasks→`SquareKanban`, Time→`Clock`, Prompts→`Quote`, Agents→`Sparkles`, Notes→`Pencil`, Brain→`Brain`, Graph→`Waypoints`, Academy→`GraduationCap`, Growth→`TrendingUp`.
3. Presence (spec §2.2) — RESTORED per Luke 2026-07-08: real presence via Supabase Realtime presence channel (`shell-presence`, keyed by user id, joined from the shell client). Topbar shows "{n} online" mono label + overlapping avatars of currently-online members. Ticket viewers (Task 9): a per-ticket presence channel (`task-{id}`) joined while the drawer is open drives "{name} is viewing this now".
4. Timer chip — pause/resume RESTORED per Luke 2026-07-08, with ZERO schema change: pause = call the existing stop action (entry saved), storing `{ projectId, projectName }` in the chip's client state (sessionStorage) as "paused"; resume = existing start action on that project (new entry). Chip states: running (green pulsing dot, pause button), paused (amber dot, End-discard-paused-state + Resume buttons per spec §2.1), hidden when neither. Multiple entries per work session is the accepted tradeoff — durations stay correct for every existing reader (John's mcp, time page, mcp-app).
5. Ticket prefixes (spec #12): new column `ticket_prefix text` on `projects` (migration 0007), auto-derived by `deriveTicketPrefix()` in `src/lib/tasks.ts` (rule below), stored on first task creation if null.
6. Conflict rule (spec §4): same `project_id` + same `area` + both status `inprogress` → conflict on both. Computed in app by pure `findConflicts()`, never stored.
7. Checklist: `jsonb` column, array of `{ text: string, done: boolean }`.
8. Task↔brain links: reuse the existing `links` table; 0007 widens the `links` and `taggables` check constraints to allow `'task'` (same pattern 0004 used for `'agent'`).
9. Stars (spec #5): display-only (matches existing single `rating` column).
10. Empty states (spec #6): one shared `<EmptyState icon title body cta?>` component (icon tile + Newsreader headline + muted copy), applied to every collection view touched.
11. Responsive (spec #7): desktop-first exactly as designed; the only concession is `min-width: 0` hygiene and horizontal scroll on the board. Mobile = follow-up issue.
12. Error states (spec #8): preserve each page's existing error handling verbatim; do not invent new patterns.
13. Idea verdict/archive (spec #13): untouched — Ideas is restyle-only, John's logic stays.

## File Structure (key files)

```
Create: src/components/shell/sidebar.tsx        — nav + wordmark + timer chip slot + user row (client)
Create: src/components/shell/topbar.tsx         — page title + search (⌘K → /search) + team avatars (client)
Create: src/components/shell/timer-chip.tsx     — live ticking chip, End & save (client)
Create: src/components/shell/app-shell.tsx      — server wrapper: fetches user/profiles/running timer/badge counts, renders sidebar+topbar+children
Create: src/components/empty-state.tsx
Modify: src/app/layout.tsx                      — fonts (next/font), body classes
Modify: src/app/globals.css                     — V2 token remap (Task 1 has the full block)
Modify: src/app/page.tsx                        — becomes Home digest
Modify: every page under src/app/*/page.tsx     — remove <AppHeader>, restyle per spec §3.x
Delete (end): src/components/app-header.tsx     — after no page references it
Create: supabase/migrations/0007_tasks.sql
Create: src/lib/tasks.ts + src/lib/tasks.test.ts
Create: src/app/tasks/page.tsx, src/app/tasks/actions.ts
Create: src/components/tasks/{board.tsx,list.tsx,task-card.tsx,task-drawer.tsx,new-task-dialog.tsx}
Create: src/app/growth/page.tsx                 — DRAFT stub per spec §3.10
Modify: src/lib/database.types.ts               — hand-add tasks table + projects.ticket_prefix (regen note in PR)
Modify: package.json                            — vitest devDep + "test" script
```

---

### Task 1: Branch + V2 design foundation (fonts + tokens)

**Files:** Modify `src/app/layout.tsx`, `src/app/globals.css`. Branch first: `git checkout -b feature/v2-frontend` from updated main.

**Requirements:** spec §1.1–§1.6 (read it). Load Geist (400–700), Geist Mono (400–500), Newsreader (400–500 + italic) via `next/font/google` with CSS variables `--font-geist`, `--font-geist-mono`, `--font-newsreader`; apply `--font-geist` as the body family. In `globals.css`, remap the `:root` shadcn variables to the V2 palette (KEEP variable names; change values — hex from spec §1.1 converted faithfully, e.g. `--background: #e7e5e0` app bg, `--card: #ffffff`, `--border: #ededeb`, `--muted: #faf9f7`, `--muted-foreground: #78716c`, `--primary: #1c1c1f`, `--accent: #efece7`, plus `--radius: 0.625rem` stays). Add a `--v2-*` block for values shadcn has no slot for: `--v2-accent-purple: #5b3fd6`, hover `#4a2fc0`, success trio, warning trio, locked trio, danger `#b0442e`, timer green `#22c55e`, amber `#e0a53f`, rail bg `#fdfcfb`, sidebar bg `#fafaf9`, ink tiers (`#1c1c1f`, `#78716c`, `#a8a29e`, `#c4c1ba`, `#b5b3ad`). Add utility classes: `.font-display` (Newsreader), `.font-mono-label` (Geist Mono, 9.5px, `.14em` tracking, uppercase, `#b5b3ad`).

**Steps:** branch → edit → `npm run build` passes → `npm run dev` + Playwright screenshot of /login (unauthenticated is fine for THIS task) showing cream bg + Geist rendering → commit `feat: v2 design tokens and font foundation`.

### Task 2: App shell (sidebar, topbar, timer chip) + layout integration

**Files:** Create the four `src/components/shell/*` files + `src/components/empty-state.tsx`; modify `src/app/layout.tsx`.

**Requirements:** spec §2.1–§2.3 exactly (sidebar 224px `#fafaf9`, wordmark row, WORKSPACE eyebrow, nav list with active state bg `#efece7`, right-aligned mono badges; topbar 52px, page title from route, search field 340px max with ⌘K chip; content `flex:1 overflow-y-auto`). Nav per Adjudication 1+2. Badges: Projects = active project count, Ideas = non-archived idea count, Tasks = current user's not-done task count (0 until Task 9 — render nothing when table missing: wrap query in try/catch), Time = this week's team hours (e.g. `18.5h`). `app-shell.tsx` is a SERVER component doing all queries (client components receive props). Timer chip per Adjudication 4: poll-free live tick client-side from `started_at`; End & save calls the existing stop logic (reuse `src/app/time/actions.ts` stop action — read it first; do not duplicate). Auth-less routes (`/login`, `/auth/*`) render WITHOUT the shell — gate in `layout.tsx` via the pathname (use a route group or check session server-side: no session → children only).

**Integration rule:** pages still render `<AppHeader>` — that's fine THIS task (double chrome temporarily); removal happens per-page in Tasks 3–7. ⌘K: global keydown → `router.push("/search")`.

**Steps:** build components → `npm run build` → dev server → **controller checkpoint: Luke signs into Google once in the Playwright browser** → Playwright screenshots (Home + Projects) verifying shell anatomy vs spec → commit `feat: v2 app shell with sidebar, topbar, and live timer chip`.

### Task 3: Restyle Projects + Time (+ remove their AppHeader)

**Requirements:** spec §3.4 (Projects: Newsreader 26px H1, project cards radius 13px padding 20/22, status pills) and §3.6 (Time: week bar chart with mono 9px value labels + day letters, entries list, serif H1). Keep all queries/actions/dialogs functionally identical — skin only. Apply `<EmptyState>` where lists can be empty. Remove `<AppHeader>` from both pages (shell provides chrome now).

**Steps:** per page: restyle → screenshot vs spec/screenshots (`02-fixed-views.png` shows sidebar treatment) → controller reviews → commit per page (`feat: v2 projects page`, `feat: v2 time page`).

### Task 4: Restyle Prompts + Agents

**Requirements:** spec §3.7 (Prompt library: serif "Prompt library" H1 + subtitle "Reusable prompts, rated by the team.", white cards, star glyphs right-aligned `#e0a53f`-family, `#tag · saved by {name}` mono meta) and §3.8 (Agents: two-tab layout Dev agents / Automations — map to existing agents data; if the app has no automations concept, render the Dev agents tab content only and omit the tab row — note in report). Stars display-only (Adjudication 9). EmptyState applied. Remove AppHeader.

### Task 5: Restyle Notes + Brain + Graph

**Requirements:** spec §3.2 (Notes: list panel `#fdfcfb` + editor max-width 680px padding 34/40, serif 30px title, backlinks panel), §3.9 (Brain), §3.3 (Graph: canvas radial-gradient bg, node type legend colors from §1.1, right detail panel `#fdfcfb`, serif "The graph" 24px). Graph = recolor/reframe the EXISTING force-graph component (`src/components/graph/graph-view.tsx`) — do not rewrite physics. Remove AppHeader from all three.

### Task 6: Restyle Ideas + Academy + profile/search/login

**Requirements:** Ideas per `Sandbox Brain Ideas.dc.html` + spec §3.11 (list + detail: verdict chips, stage pills, quick-capture form styling; LOGIC untouched — Adjudication 13). Academy: shell + tokens + serif H1s + card restyle using generic V2 vocabulary (no bespoke spec — spec #10). Profile/search/login: tokens + typography pass only. Remove AppHeader everywhere it remains, then DELETE `src/components/app-header.tsx` and verify no imports remain (`grep -r "app-header" src/`).

### Task 7: Home digest page

**Files:** Rewrite `src/app/page.tsx` (+ small server-only helpers in `src/lib/home-digest.ts` if useful).

**Requirements:** spec §3.1: greeting header (`Good morning/afternoon/evening, {first name}` — Newsreader 29px + mono date `MON · JUL 6`), summary line ("{N} things moved through the brain since you left."), FLOWING NOW feed (union of recent activity: notes updated, prompts created, time entries logged, ideas created — each rendered as "{Actor} {verb} {object} → {context}" + mono relative time; latest 8, server query), right rail `#fdfcfb`: ACTIVE PROJECTS with % (share of this week's time per project), THIS WEEK · {total}H mini bar chart per weekday, mono day letters. No feed items → EmptyState. Relative-time + digest assembly as pure functions with vitest tests if any nontrivial logic emerges (weekday bucketing: test the UTC/local boundary — use LOCAL dates, cite `feedback_js_dates_timezone`: never `toISOString()` for local day math).

### Task 7b: Growth page (real pipeline metrics)

**Files:** Create `src/app/growth/page.tsx` (+ `src/lib/growth.ts` pure helpers if bucketing logic is nontrivial — tests for any date math, LOCAL dates only).

**Requirements:** spec §3.10 layout language (funnel strip + metric blocks) but with REAL data per Adjudication 1: Captured / Validating / Building / Shipped counts as defined there, weekly team-hours trend (last 6 weeks, mono labels). Server component, queries in-file or via lib. EmptyState if the funnel is all zeros. Note: tasks-table queries must try/catch (table may not exist until 0007 applies) and degrade to ideas+projects-only counts.

### Task 8: Tasks backend (migration + lib + actions + tests)

**Files:** Create `supabase/migrations/0007_tasks.sql`, `src/lib/tasks.ts`, `src/lib/tasks.test.ts`, `src/app/tasks/actions.ts`; modify `src/lib/database.types.ts`, root `package.json` (add `vitest` devDep + `"test": "vitest run"`).

**Migration (complete — use verbatim, house style per 0001/0004):**

```sql
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

-- Widen entity checks so links/taggables can reference tasks (pattern from 0004).
alter table public.links drop constraint if exists links_source_type_check;
alter table public.links add constraint links_source_type_check
  check (source_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent', 'idea', 'task'));

alter table public.links drop constraint if exists links_target_type_check;
alter table public.links add constraint links_target_type_check
  check (target_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent', 'idea', 'task'));

alter table public.taggables drop constraint if exists taggables_entity_type_check;
alter table public.taggables add constraint taggables_entity_type_check
  check (entity_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'time_entry', 'agent', 'idea', 'task'));
```

**IMPORTANT — before finalizing the migration:** read `supabase/migrations/0006_ideas.sql` and mirror its EXACT current check-constraint value lists for links/taggables (0005/0006 may have already widened them with `'idea'` or academy types — the lists above are a best guess; the real lists must be a superset of what main has, plus `'task'`). Getting this wrong breaks existing features.

**`src/lib/tasks.ts` (pure, fully tested — TDD):**
- `deriveTicketPrefix(name: string): string` — rule: split on whitespace; 2+ words → first letter of each of the first 3 words, uppercased ("Ramp landing" → "RL", "Sidequest v2" → "SV"); 1 word → first letter + next 2 consonants uppercased ("Ramp" → "RMP", "Warehouse" → "WRH"); result clamped to 2–3 chars, A–Z only, fallback "TSK". (Design seeds used hand-picked prefixes; this rule is the documented approximation — prefix is stored + editable later, so drift is cosmetic.)
- `formatTicketId(prefix: string, num: number): string` → `"RMP-14"`.
- `findConflicts(tasks: {id, project_id, area, status}[]): Map<string, string[]>` — per Adjudication 6; returns task id → conflicting task ids.
- Tests (write FIRST, watch fail): prefix rules incl. clamps/fallback/non-alpha input; formatTicketId; findConflicts positive (two inprogress same project+area), negative (different area / different project / one not inprogress),三-way conflict (all three flagged).

**Actions (`src/app/tasks/actions.ts`, house style = `projects/actions.ts` + `ideas` actions):** `createTask` (assigns `ticket_num` = max+1 per project via select; sets project `ticket_prefix` via `deriveTicketPrefix` if null), `updateTaskStatus`, `claimTask` (only if `claimed_by` is null OR self), `releaseTask` (only self), `toggleChecklistItem`, `updateTask` (title/priority/area/assignee). Each returns `{ error: string | null }`, `revalidatePath("/tasks")`.

**Validation gates:** vitest green; migration applies cleanly on Docker: `docker run --rm -d --name pgtest -e POSTGRES_PASSWORD=t -p 55432:5432 postgres:17` then apply 0001→0007 in order via psql (0001 needs `auth` schema stub: `create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb); create or replace function auth.uid() returns uuid language sql as 'select null::uuid'; create or replace function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;` first) — expect zero errors on 0007; then `docker rm -f pgtest`. `database.types.ts`: hand-add the `tasks` Row/Insert/Update block + `ticket_prefix` on projects, matching the file's existing generated style; add a `-- regen after apply` note in the PR body instead of running db:types (prod not migrated yet).

### Task 9: Tasks UI (board, list, drawer, dialog) + sidebar badge

**Files:** Create `src/app/tasks/page.tsx` + the five `src/components/tasks/*` files; update the shell's Tasks badge query (Task 2 left it try/caught).

**Requirements:** spec §3.5 + §4 anatomy: header (serif "Tasks" 26px + subtitle "Claim a ticket to lock it to you · overlaps are flagged before they become conflicts."), project filter pills ("All projects" + per-project), Board/List segmented toggle, "+ New ticket" black pill button. Board: 5 columns (`#faf9f7`, radius 12, mono uppercase column headers + count), cards (white, radius 10, resting/hover shadows from §1.5, priority dot colors §4, area tag colors §4, ticket id mono 10px, conflict ⚠ `#c2410c` with title tooltip "Same area as {name} · {ticketId}"), empty column → "No tickets" `#c4c1ba`. List: table per §4 Views. Drawer: right slide-over 396px, scrim `rgba(28,28,31,.28)`, serif 23px title, conflict banner (warning trio), claim states per §4 Lock state (unclaimed → black "Claim this ticket"; mine → green bar + Release; other → tan locked bar + disabled status buttons/checklist), status segmented buttons, checklist with strikethrough done items, LINKED IN THE BRAIN section reading the `links` table (render existing links only; creating links = follow-up). Status changes optimistic where cheap; otherwise plain server-action + revalidate. **IMPORTANT: the tasks table does not exist in prod.** All UI must be verified against LOCAL data only via the Docker postgres? No — simpler: page queries prod and will show an error until migration is applied. Guard: if the `tasks` query errors with "relation ... does not exist", render a designed pre-migration notice card ("Tasks is waiting on migration 0007 — apply supabase/migrations/0007_tasks.sql") instead of crashing. Playwright-verify: page renders the notice against prod; component correctness verified via vitest for pure parts + screenshot of board rendered with a temporary in-file mock array behind a `?demo=1` search-param (remove flag? NO — keep `?demo=1` as a harmless demo mode using the design's seed-like data; document it in the PR as the review aid).

### Task 10: Full verification + review packet (STOP before PR)

**Steps:** `npm run build` + `npm test` + `npx tsc --noEmit` all green; `git diff main --stat` — only expected files; Playwright walkthrough signed-in: screenshot EVERY page (home, projects, ideas, tasks board `?demo=1` + drawer open, time, prompts, agents, notes, brain, graph, academy, growth) saved to the scratchpad; controller assembles the screenshot set and presents to Luke for review. **HARD STOP — no push, no PR, until Luke's explicit go-ahead.** On go-ahead: push `feature/v2-frontend`, PR titled "V2 frontend: editorial workspace redesign + Home digest + Tasks" with body covering scope, adjudications (light-only, presence deferred, demo mode, migration apply instructions + types regen note), screenshot links, and credit to the teammate's design.

## Self-Review (completed)
1. Spec coverage: every §3 screen has a task; §4 model → Task 8; all 13 ambiguities adjudicated in header.
2. Placeholder scan: page-restyle tasks intentionally delegate pixel detail to cited spec sections (single source of truth); all code-bearing tasks (1, 8) carry complete code; migration constraint-list risk explicitly flagged with a read-first instruction.
3. Type consistency: `tasks` columns ↔ actions ↔ lib helpers ↔ UI status/area/priority literals all use the §4 sets verbatim.
