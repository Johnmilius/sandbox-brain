# V2 Frontend — Handoff Document

**Status date:** 2026-07-08 · **Branch:** `feature/v2-frontend` (off main a127f41)
**For:** any agent or human continuing this work. Everything needed is in this folder + the plan. Read this file, then `PLAN.md`, then `DESIGN-SPEC.md` sections as each task cites them.

## What this is

Full V2 frontend rebuild of sandbox-brain to the teammate's "editorial workspace" design (cream palette, Newsreader serif display + Geist/Geist Mono, left sidebar shell), plus two NEW features: a Home digest and a Tasks board (kanban with claiming + conflict detection). Original design zip: `C:\Users\lukeb\Downloads\Sandbox brain project design.zip` (Luke's machine). `DESIGN-SPEC.md` in this folder is the extracted, implementation-ready spec — it is the design source of truth; cite sections by number.

## Progress (tasks 1–3 of 11 DONE, reviewed unless noted)

| Task | Status | Commits | Notes |
|---|---|---|---|
| 1. Tokens + fonts | ✅ reviewed/approved | 2b76be6 | 56/56 hex verified vs spec §1.1. Light-only (spec has no dark mode). |
| 2. App shell | ✅ reviewed/approved (after fix) | 1b249e2, aa86573, 56d8cc7 | Sidebar/topbar/timer-chip/empty-state + layout gating. Realtime presence WORKS (Supabase channel `shell-presence`). Timer pause/resume = stop+restart pattern, sessionStorage marker, zero schema change. |
| 3. Projects + Time restyle | ⚠️ DONE, **NOT yet reviewed** | ccc48ef, ab49633 | Open question: implementer kept the old 14-day chart behind a collapsed `<details>` on /time — controller leaned toward removing it (V2 purity); decide in review. |
| 4–10 | ⏳ not started | — | See PLAN.md Tasks 4–10 (+7b). |

## Remaining work (in order)

4. Restyle Prompts + Agents (PLAN Task 4, spec §3.7/§3.8)
5. Restyle Notes + Brain + Graph (Task 5, spec §3.2/§3.9/§3.3 — graph recolor only; NOTE: chart-1..5 var order in globals.css does NOT match spec legend order, map deliberately)
6. Restyle Ideas + Academy + aux pages; then DELETE src/components/app-header.tsx after last usage removed (Task 6)
7. Home digest (Task 7, spec §3.1) · 7b. Growth page with REAL pipeline metrics (amended — see PLAN adjudications)
8. Tasks backend: migration 0007 (full SQL in PLAN — validate against Docker postgres, NEVER prod; MUST first mirror current constraint lists from 0005/0006), lib helpers TDD w/ vitest, server actions (Task 8)
9. Tasks UI: board/list/drawer, claim/lock/conflict, per-ticket viewer presence, `?demo=1` mode, pre-migration notice card (Task 9). ALSO FIX HERE: zero-count tasks badge in app-shell.tsx renders "0", should render "" (one-token fix, deferred finding).
10. Verification packet → **Luke reviews → HARD STOP → PR to John only on Luke's explicit go-ahead** (Task 10)

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
