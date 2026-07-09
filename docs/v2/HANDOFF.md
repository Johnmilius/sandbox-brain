# V2 Frontend — Handoff Document

**Status date:** 2026-07-08 · **Branch:** `feature/v2-frontend` (off main a127f41)
**For:** any agent or human continuing this work. Everything needed is in this folder + the plan. Read this file, then `PLAN.md`, then `DESIGN-SPEC.md` sections as each task cites them.

## What this is

Full V2 frontend rebuild of sandbox-brain to the teammate's "editorial workspace" design (cream palette, Newsreader serif display + Geist/Geist Mono, left sidebar shell), plus two NEW features: a Home digest and a Tasks board (kanban with claiming + conflict detection). Original design zip: `C:\Users\lukeb\Downloads\Sandbox brain project design.zip` (Luke's machine). `DESIGN-SPEC.md` in this folder is the extracted, implementation-ready spec — it is the design source of truth; cite sections by number.

## Progress (tasks 1–9 + 7b of 11 DONE; 3–9 NOT yet reviewed)

| Task | Status | Commits | Notes |
|---|---|---|---|
| 1. Tokens + fonts | ✅ reviewed/approved | 2b76be6 | 56/56 hex verified vs spec §1.1. Light-only (spec has no dark mode). |
| 2. App shell | ✅ reviewed/approved (after fix) | 1b249e2, aa86573, 56d8cc7 | Sidebar/topbar/timer-chip/empty-state + layout gating. Realtime presence WORKS (Supabase channel `shell-presence`). Timer pause/resume = stop+restart pattern, sessionStorage marker, zero schema change. |
| 3. Projects + Time restyle | ⚠️ DONE, **NOT yet reviewed** | ccc48ef, ab49633 | Open question: implementer kept the old 14-day chart behind a collapsed `<details>` on /time — controller leaned toward removing it (V2 purity); decide in review. |
| 4. Prompts + Agents | ⚠️ DONE, not reviewed | a24505b, e4f62b9 | Agents got the Dev agents/Automations tab row (`?tab=automations` → designed empty state; no automations backend exists). Agent star ratings omitted — no `rating` column (see OPEN-ITEMS.md). |
| 5. Notes + Brain + Graph | ⚠️ DONE, not reviewed | 64f8263, 6787211, 634a6d9 | Graph TYPE_COLORS mapped deliberately per spec legend; extra types (knowledge/academy/idea) extend palette. Wikilinks purple via markdown-view. Brain got the ask-the-brain card → /search. |
| 6. Ideas + Academy + aux | ⚠️ DONE, not reviewed | ce1a02e, d4d9199 | Ideas logic untouched (Adjudication 13). AppHeader deleted with Task 7 commit (last usage was Home). |
| 7. Home digest | ⚠️ DONE, not reviewed | 473ffff | Feed union (notes/prompts/ideas/time), right rail w/ project % + week bars. Pure helpers in src/lib/home-digest.ts, 12 vitest tests, LOCAL dates. |
| 7b. Growth (real metrics) | ⚠️ DONE, not reviewed | b4316a0 | Funnel from live ideas/projects(+tasks when 0007 applied), 6-week team-hours trend. 13 tests. Vitest moved up from Task 8. |
| 8. Tasks backend | ⚠️ DONE, not reviewed | 9de3453 | **Constraint lists mirror 0006 exactly + 'task'** (plan's guess was missing academy_module/academy_outcome — trap avoided). Validated on Docker postgres:17: 0001,0003–0007 apply clean; smoke test verified unique ticket_num, status check, links widening, tsvector. 0002 (storage) skipped in Docker — needs Supabase storage schema, no 0007 dependency. 14 tests (prefix/format/conflicts). |
| 9. Tasks UI | ⚠️ DONE, not reviewed | 5362155 | Board/list/drawer/dialog + `?demo=1` read-only demo mode + pre-migration notice card + per-ticket presence (`task-{id}`). Badge fix: column is `assignee` (was querying `assignee_id`) and zero renders "". |
| 10. Verification packet | ⏳ gates green, packet pending | — | tsc ✅ build ✅ lint ✅ 39/39 tests ✅ diff scope clean. Playwright signed-in screenshot walkthrough NOT done (no signed-in browser session available to the agent) — do this before Luke's review. **HARD STOP before PR stands.** |

## Remaining work

10. Visual walkthrough (signed-in screenshots of every page incl. tasks `?demo=1` + drawer) → Luke reviews → **HARD STOP → PR to John only on Luke's explicit go-ahead**. Migration 0007 must be applied to prod (`npm run db:push`) before Tasks goes live; regen types after (`npm run db:types`).

## Open items needing a decision, not just styling

See `docs/v2/OPEN-ITEMS.md` — conceptual/data gaps found during Task 4
(automations has no creation flow or backend concept yet; agent star ratings
have no data column; "used on N tickets" stat needs Tasks to exist).

## Deferred review findings (fold into final whole-branch review)

- timer-chip.tsx: `[runningEntry]` effect dep recreates interval more than needed (cosmetic)
- app-shell.tsx: tasks badge zero-count renders "0" not "" (fix in Task 9)
- /time page: `<details>` with legacy 14-day chart — keep or cut (Task 3 review pending)

## Conventions that bind ALL work

- **NEVER add Co-Authored-By or any AI attribution to commits** (hard repo rule)
- Skin-only on existing pages: queries/actions/dialog logic unchanged
- Use `--v2-*` CSS vars + `.font-display`/`.font-mono-label` from globals.css — no raw hex where a var exists
- Supabase-js does NOT throw — check `{ error }` on responses, never try/catch as the guard
- LOCAL dates for day bucketing — never `toISOString()` for day math
- Conventional commits; build gates: `npx tsc --noEmit` + `npm run build` green before every commit
- Verification is visual too: dev server + signed-in browser (Luke's Google session; he's on the allowlist). Playwright screenshots reviewed by the controller.
- Process: subagent-driven development (fresh implementer per task, reviewer gate per task, fix→re-review loop, final whole-branch review before Luke's packet). Progress ledger: `.git/sdd/progress.md` (local only).

## Related but separate (do not touch in this branch)

- `mcp/` — John's MCP server · `mcp-app/` — PR #4 (Skybridge dashboard widget, open)
- Open issues: #1 (per-user auth), #2 (MCP Apps dashboard — answered by PR #4)
