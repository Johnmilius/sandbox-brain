# V2 Design Audit — Implementation vs. Design

> ## ✅ RESOLUTION PASS — 2026-07-09
> A full fix pass closed the gaps below, treating the design as the source of
> truth for the ⚑ intent questions. Status per section:
>
> - **Global (G1–G4)** ✅ — `#white` typo fixed, cream `#e7e5e0` body behind a white shell, `.dark` block removed (light-only), mono-label 10px with a 9.5px sidebar variant, design scrollbar + `flowSlow` keyframe added.
> - **Home (H1–H13)** ✅ — filter pills (All/Mine/top project), animated twin-rail flow line, kind-tinted entity chips with `→` context chip, hollow 14px actor-color dots, identity-colored actor names, TIME LOGGED header + "total" stat + caption footer w/ black swatch, rail metrics; **H11 resolved as completion %** (tasks done/total, time-share fallback pre-0007). Rail + project cards deep-link to `/tasks?project=…`.
> - **Projects (P1–P7)** ✅ — progress-tile restored: hours top-right, `{pct}% · {done}/{total} tasks done` + people + 6px bar, whole card links into Tasks, Geist 15/600 name. Status pill kept only for non-active projects; edit button retained.
> - **Tasks (T1–T6)** ✅ — conflict border `#e6c9b0`, open-card black border, 7px dots, 5px title-cased area pills, `#b5b3ad` ticket ids, 22px avatars.
> - **Prompts (PR1–PR3)** ✅ — radius 12 / padding 16×20, 12.5px body, single 11px mono meta line.
> - **Agents (A1/A3)** ✅ — per-agent icon tints (38px/r10 tile), mono tool chips. **A2 (star rating) & A4 (tickets-usage stat) still open — need a DB column / agent↔task links.**
> - **Time (TM1–TM2)** ✅ — stacked-by-project chart w/ legend, y-axis gridlines, dashed `avg Xh` line, hover value reveal. **TM4 resolved: legacy 14-day chart removed** (not in design; `daily-hours-chart.tsx` left on disk, unused).
> - **Ideas (I1–I11)** ✅ — list: quick-capture bar + stage chips w/ counts + filter search + lifecycle track + 7-bar sparkline + avg + ◇ badge + designed empty state; detail: radar SVG, click-to-score bars, clickable verdict pills, lifecycle stepper, archive toggle, 300px right rail (similar % + bar, type-ahead related linking, graph link), two-step promote banner.
> - **Graph (GR1–GR6)** ✅ — full-bleed canvas, degree-sized icon nodes w/ label halos, click-to-focus w/ rings + dimming + edge emphasis, 270px detail rail (CONNECTED TO, open link), in-canvas legend (still doubles as type filter), filters kept as overlay.
> - **Notes (N1–N8)** ✅ — 3-pane rebuilt: persistent 270px list rail (layout route) w/ colored `#tags` + snippets, `/notes` jumps to latest note, editor 15px/1.85 `#33312e` body + `edited … · N links` meta, 250px backlinks rail w/ context + graph link.
> - **Brain (B1–B6)** ✅ — canon layer from existing data: 5 kind-categories w/ icon+blurb+count, freshness dots (60-day rule), `current / need review` stats row, provenance from links (`◍ from N notes · M tickets`), owner avatar + updated stamp, purple example pills, designed ask-card inner box.
> - **Shell (S1–S7)** ✅ — solid nav hover, 8px radius / 7×9 padding / 13.5px items, 16px icons, 1px gap, 9px wordmark gap, presence avatars cycle blue/green.
> - **Still flagged for you:** Academy + Profile (no design exists), A2/A4 above, and the Growth funnel story (kept as the intentional idea-pipeline rebuild).
>
> Verified: `npm run build` (all 19 routes, TS clean) + `npm run lint` (clean; `docs/**` excluded from lint as reference material).

**Started:** 2026-07-09 · **Auditor:** Claude (Opus 4.8)
**Method:** Code-vs-code comparison of the implemented Next.js app against the design source of truth — `Sandbox Brain.dc.html` / `Sandbox Brain Ideas.dc.html` (raw readable CSS/markup) and `DESIGN-SPEC.md`. Screenshots used where they exist. Live-render checks noted where done.

**Severity key:**
- 🔴 **High** — missing feature, wrong layout, or a value users will notice (wrong accent color, missing section)
- 🟡 **Med** — off by a visible amount (font size 1–2px, wrong shade, spacing, wrong hover)
- 🟢 **Low** — cosmetic / sub-pixel / arguably intentional

**Pages flagged, NOT audited (no design reference — need your input, still in development):**
- **Academy** — appears nowhere in any `.dc.html` or screenshot (confirmed DESIGN-SPEC §5 item 10). Added during build. ⚑ *You to review / provide design.*
- **Profile** — no design reference. Added during build. ⚑ *You to review / provide design.*

---

## Global tokens (`src/app/globals.css`)

| # | Element | Design | Implemented | Sev |
|---|---|---|---|---|
| G1 | `--background` value | `#fff` (app shell white) / body `#e7e5e0` | `--background: #white;` — **invalid CSS** (typo, not a real color). Falls back to initial/transparent. | 🔴 |
| G2 | Dark mode | Spec §1.6: light-only, no dark tokens anywhere | Full `.dark {}` oklch block present (shadcn default). Not in design. Harmless only if `.dark` is never toggled — verify no theme switcher ships. | 🟡 |
| G3 | `.font-mono-label` size | Eyebrow labels are **10px** in most places (Home/Notes/rails), 9.5px only in the sidebar WORKSPACE label | Hardcoded `9.5px` for ALL mono-labels | 🟡 |
| G4 | App outer background | body `#e7e5e0` (warm cream) behind the white shell | Not set on body (relies on `--background` which is broken, G1). The signature cream frame may not render. | 🔴 |

> Note: the V2 token values that *are* defined (`--v2-*`, accent purple, ink tiers, semantic colors) match the spec exactly. The issues above are the outer-shell background wiring and the one-size mono label.

---

## 1. Home (digest) — `src/app/page.tsx`

Design source: `Sandbox Brain.dc.html` lines 106–175. No reference screenshot (spec §5 item 2) — audited against CSS.

### 🔴 High

| # | Element | Design | Implemented |
|---|---|---|---|
| H1 | **"Flowing now" filter pills** | Row of 3 filter pills (All / Mine / Ramp) right-aligned in the section header; active = black bg/white text, inactive = `#f4f2ef` bg / `#78716c` text | **Completely absent.** Only the "Flowing now" label renders — no filter control at all. |
| H2 | **Timeline rail (the "flow")** | Two stacked rails: a static `#e7e5e0` 2px line + an animated dashed gradient (`#a8a29e` dashes, `flowSlow` keyframe scrolling) — the signature "flowing" motion | Single **static** `1px dashed #d6d3cd` border. Wrong width (1 vs 2px), wrong color, **no animation.** The defining Home visual is gone. |
| H3 | **Feed entity chips** | Object rendered as a colored **pill chip** (bg+fg per entity kind: note/prompt/project/brain), with `chipA → chipB` construction and colored `→` arrow | Object rendered as a plain **purple hyperlink** + grey "→ context" text. No colored chips, no A→B chip pair. |
| H4 | **"Time logged" footer caption** | Caption row with black square swatch: "Thu is today — your busiest day at 4.0h" | Absent. |

### 🟡 Med

| # | Element | Design | Implemented |
|---|---|---|---|
| H5 | Feed timeline dot | 14px circle, **white fill + 2px actor-color border** (hollow ring) | 8px (`size-2`) **solid** kind-color dot with white border. Wrong size + hollow-vs-solid. |
| H6 | Actor name color | Colored per person identity (`f.actorColor`) | Plain default ink, bold only. Identity color lost. |
| H7 | Right-rail top padding | `30px 22px` | `26px 22px` (top short by 4px) |
| H8 | Right-rail border-left color | `#f0eeeb` | `#ededeb` (used the generic border, not the topbar-tone border) |
| H9 | Date label size | mono **11px**, no tracking | mono **10px** + `tracking-[0.1em]` added |
| H10 | "Time logged" section structure | Eyebrow "TIME LOGGED" + separate "18.5h total" stat on the same baseline row; subtitle "Hours the team tracked each day this week." | Merged into one label "This week · {h}h"; subtitle reworded "Whole team, completed sessions." Structure + copy differ. |
| H11 | Active-projects `%` meaning | `%` = task-completion percent of the project | `%` = that project's **share of this week's hours**. Different metric behind the same-looking bar. ⚑ *Design intent question — see below.* |
| H12 | Project row name / pct sizes | name 13px / pct mono 11px | name 12.5px / pct mono 10px |
| H13 | Week-bar container height | 66px | 84px wrapper (58px bars) |

### 🟢 Low
- Feed meta is mono 10px vs design 11px (H9-adjacent).
- Projects rail gap 14px (`gap-3.5`) vs design 15px.
- Feed gap 16px matches; padding matches.

**⚑ Design-intent question (H11):** The Home right-rail progress bars — should they show **project completion %** (design's apparent intent, matches the Projects page bars) or **share of this week's logged hours** (what's built)? These tell very different stories. Which do you want?

---

## 2. Projects — `src/app/projects/page.tsx`

Design source: `Sandbox Brain.dc.html` lines 274–291. No reference screenshot (inferred from CSS).

### 🔴 High

| # | Element | Design | Implemented |
|---|---|---|---|
| P1 | **Card completion footer** | Footer stat row `"{pct}% · {done}/{total} tasks done"` (mono) + people list, then a **progress bar** (6px, track `#efece7`, fill `#1c1c1f`) | Replaced entirely by a single `"created {date}"` mono line. **No progress bar, no task counts, no people.** The project-health story is gone. |
| P2 | Card is a link to Tasks | Whole card clickable → navigates to Tasks scoped to that project (`p.onClick`) + `rowhover` bg `#faf9f7` | Card is a plain `<div>` — **not clickable**, no hover. (Edit button is the only action.) |
| P3 | Hours-logged stat | Top-right of card = hours-logged mono stat (`{{ p.hours }}`) | Top-right = **status pill** (Active/Paused/…) + edit button instead. Hours stat absent. |
| P4 | Project name font | **Geist, 15px, weight 600** (sans) | `font-display` (**Newsreader serif**), 16px. Wrong family + size. |

### 🟡 Med

| # | Element | Design | Implemented |
|---|---|---|---|
| P5 | Subtitle size | 13px | 13.5px |
| P6 | Description size | 12.5px | 13px |
| P7 | Icon tile | `▦` glyph in 36px tile | `LayoutGrid` lucide icon (acceptable substitute, but note glyph→icon swap is app-wide) |

**Additive (not in design — likely intentional product additions):** status pill, edit button, "New project" button, empty state. Fine to keep — but P1/P3 mean the card lost its designed information (completion + hours) in favor of status/created-date.

**⚑ Design-intent question (P1–P3):** Design's project card is a *progress dashboard tile* (hours, % complete, task count, people, bar) that deep-links into Tasks. The build turned it into a *CRUD tile* (status pill, edit, created date). Do you want the designed progress-tile restored, or is the CRUD tile the new intent?

---

## 3. Notes — `src/app/notes/page.tsx` + `notes/[id]/page.tsx` + `note-editor.tsx`

Design source: `Sandbox Brain.dc.html` lines 177–225. No reference screenshot.

### 🔴 High — architecture differs from design

| # | Element | Design | Implemented |
|---|---|---|---|
| N1 | **Overall layout** | **Single screen, 3 columns**: note-list rail (270px, `#fdfcfb`) │ editor (flex, max 680px) │ backlinks rail (250px, `#fdfcfb`). List + editor + backlinks all visible together. | **Two separate routes.** `/notes` = single-column card list (max-w 840px); `/notes/[id]` = editor page. No persistent list rail, no side-by-side editing. |
| N2 | **Backlinks placement** | Right rail ("◍ LINKED FROM" card list + "◷ IN THE GRAPH" link), always beside the editor | Stacked **below** the editor body, after a top border. Functionally present, spatially different. |
| N3 | Note tag / colored `#tag` | Each list row + editor shows a colored `#tag` (marketing=purple, strategy=green, product=blue, project=gold) | **No tags rendered anywhere.** The tag color-coding system is absent (no tag data surfaced). |
| N4 | Editor meta line | "edited {time} · {n} links" mono line under the title; and a mono tag eyebrow **above** the title | Neither present — title goes straight to body. |

### 🟡 Med

| # | Element | Design | Implemented |
|---|---|---|---|
| N5 | List card style | Row on `#fdfcfb` rail, radius 9px, `rowhover` bg change, no shadow | Card with **shadow on hover** (`0 4px 14px…`) on white. Design uses flat rail rows, not elevated cards. |
| N6 | List snippet size | 11.5px `#a8a29e` | 12.5px `--v2-ink-2` |
| N7 | Editor body text | 15px / line-height **1.85** / color `#33312e` | Wrapper sets 15px/1.85 but `MarkdownView` inner root forces `text-sm` (14px) / `leading-relaxed` (1.625). Body renders **14px**, not 15px. Color `--v2-ink-1`. |
| N8 | Edit-mode title size | contenteditable 30px | Input `!text-[26px]` (view mode is 30px, edit mode shrinks to 26px — inconsistent) |

### 🟢 Low
- Wikilink styling **matches** design (`.wlink`): purple text, `#cdc6f0` underline, `#efe9ff` hover bg, purple-hover text. ✅
- Backlink card radius 10px, border `#ededeb` ✓.

**⚑ Design-intent question (N1):** Design is a Obsidian-style 3-pane single screen; the build is a conventional list→detail router flow. This is a real product-shape decision, not a bug. Keep the router flow, or rebuild the 3-pane layout? (Also decide whether Notes should have tags at all — N3.)

---

## 4. Graph — `src/app/graph/page.tsx` + `graph-explorer.tsx` + `graph-view.tsx`

Design source: `Sandbox Brain.dc.html` lines 227–272. Screenshots: `03-graph-physics.png`, `graph-current.png`.

The build uses the `react-force-graph-2d` **canvas** library; the design is a hand-rolled **DOM** graph. Different engine → most of the designed node treatment is absent.

### 🔴 High

| # | Element | Design | Implemented |
|---|---|---|---|
| GR1 | **Node visuals** | Circles **sized by degree** (`26+deg*2.6px`), each with a **type icon** inside (note ✎, prompt ❝, project ▦, person ☺, agent ✦) + label below with white text-shadow halo | Flat **4px** canvas dots, uniform size, **no icons**, plain grey label. |
| GR2 | **Selection states** | 3 states — selected (solid fill, white icon, glow), connected-to-selected (tinted fill + colored border + colored icon), unrelated (dimmed grey 0.55 opacity) + two concentric **focus rings** (190/290px) | None. No selection concept; clicking a node **navigates away** to its URL instead of focusing it. |
| GR3 | **Detail panel** (270px right rail) | Node type label (colored) + Newsreader node label (23px) + connection count + "CONNECTED TO" clickable list + "Open note →" | **Absent entirely.** Replaced by top-of-page `Select` dropdowns (person/project) + "Suggested links" checkbox. |
| GR4 | Canvas framing | **Full-bleed** flex canvas filling the view, detail rail on the right | Boxed in a **rounded bordered card** (`h-[calc(100vh-16rem)]`, `max-w-6xl` centered). Not full-bleed. |

### 🟡 Med

| # | Element | Design | Implemented |
|---|---|---|---|
| GR5 | Legend | Static, **bottom-left inside canvas**, mono 10.5px, 5 dots | Interactive toggle buttons **above** the canvas (doubles as type filter). Functional bonus, but placement + role differ. |
| GR6 | Edge styling | Selected-adjacent edges accent-colored 1.8px op .65; rest grey `#cfc9c0` 1.1px op .32 | Grey `#cfc9c052`; suggested edges dashed accent `#5b3fd633`. No selection-driven emphasis. |
| GR7 | Title subtitle | "142 connections · drag the nodes around" | dynamic (connection count) — verify copy; title "The graph" 24px ✓ |

### 🟢 Low
- Canvas radial-gradient background matches spec exactly. ✅
- Type→color mapping matches the legend spec; extends palette for knowledge/academy/idea (documented). ✅

**Note:** the build adds real filtering (person/project/type/suggested-links) the design never had — genuinely useful. But the designed **interactive node-focus + detail-panel experience** is not implemented; the graph is a filter-and-navigate tool, not an explore-in-place canvas. ⚑ *Product-shape decision — your call.*

---

## 5. Tasks (board / list / drawer) — `src/components/tasks/*`

Design source: `Sandbox Brain.dc.html` lines 293–445. Screenshots: `02-tasks-board.png`, `tasks-list-clean.png`. **This is the closest-matching page** — the board, list, and drawer track the design well.

### 🟡 Med / 🟢 Low

| # | Element | Design | Implemented | Sev |
|---|---|---|---|---|
| T1 | Conflict card border tint | Card border uses `t.cardBorder` — conflict cards get a colored (orange-tinted) border | Card border fixed `#ededeb`; only the ⚠ icon signals conflict, not the border | 🟡 |
| T2 | Priority dot size | 7px | `size-2` (8px) | 🟢 |
| T3 | Area pill radius | 5px | 6px | 🟢 |
| T4 | Area pill label | `t.areaLabel` (proper-cased) | raw `task.area` key (e.g. lowercase "frontend") — verify it's title-cased | 🟢 |
| T5 | Ticket ID color | mono 10px `#b5b3ad` | `--v2-ink-3` (`#a8a29e`) | 🟢 |
| T6 | Card footer avatar | 22px | `size-5` (20px) | 🟢 |

**Drawer, board columns, list table** all match the spec structure (396px slide-over, `slideover` animation, backdrop `rgba(28,28,31,.28)`, claim/lock 3-state blocks, status pills, checklist, "◍ linked in the brain", conflict banner). Verified against `02-tasks-board.png` — visually faithful. ✅

---

## 6. Time — `src/app/time/page.tsx` + `daily-hours-chart.tsx`

Design source: `Sandbox Brain.dc.html` lines 448–511. No reference screenshot.

### 🔴 High

| # | Element | Design | Implemented |
|---|---|---|---|
| TM1 | **The main chart** | ONE bordered card with a **stacked-by-project bar chart**: per-project colored segments (Ramp=black, Sidequest=accent purple, Warehouse=sage `#b7cfc0`), a **project legend**, **y-axis gridlines** (0/2/4/6h), and a dashed **average line** annotated "avg {x}h" | A **plain single-value** week bar chart (same as Home's mini chart). **No project segments, no legend, no y-axis, no average line.** The designed analytical chart is not built. |
| TM2 | Chart-per-bar hover | `.tbar:hover` reveals value + brightens the top segment | Static bars, no hover reveal |

### 🟡 Med / additive

| # | Element | Design | Implemented |
|---|---|---|---|
| TM3 | Page composition | Chart card + simple entries list | Adds Timer card, "Last 7 days", "Top projects", "By person" stat cards + a full entries **table** (Project/Who/When/Duration/Notes/activity). Much richer, but diverges from the two-card design. |
| TM4 | Legacy 14-day chart | not in design | kept behind a `<details>` toggle — **the open question flagged in HANDOFF.md.** ⚑ *Keep or cut?* |
| TM5 | Header copy | "Team logged 18.5h this week · you 6.2h." | matches pattern ✅ |

**⚑ Design-intent question (TM1):** Do you want the designed **stacked-by-project chart with legend + average line** rebuilt, or is the current simpler week-bar + stat-card dashboard the intended direction? (This is the biggest Time gap.)

---

## 7. Prompts — `src/components/prompts/prompt-card.tsx`

Design source: `Sandbox Brain.dc.html` lines 513–528. Screenshot: `02-fixed-views.png`. **Close match.**

| # | Element | Design | Implemented | Sev |
|---|---|---|---|---|
| PR1 | Card radius / padding | radius 12px, padding `16px 20px` | radius 13px, padding `16px 18px` | 🟢 |
| PR2 | Body size | 12.5px `#78716c` | 13px `--v2-ink-2` | 🟢 |
| PR3 | Footer meta | one mono line `{tag} · saved by {author}` (11px `#a8a29e`) | two lines (tool·project + tag·author), 10/10.5px, second line uses `--v2-ink-label` | 🟢 |
| PR4 | Star rating | static gold `★★★★☆` glyph | ✅ matches (renders from `rating`, gold `--v2-amber`) | ✅ |

**Additive (fine):** favorite toggle, copy, edit, delete, view dialog, empty state. Prompts is in good shape.

---

## 8. Agents — `src/components/agents/agent-card.tsx`

Design source: `Sandbox Brain.dc.html` lines 530–595. Screenshot: `02-agents-registry.png`. **Close match with two real gaps.**

### 🟡 Med

| # | Element | Design | Implemented |
|---|---|---|---|
| A1 | **Per-agent icon color** | Icon tile colored **per agent** (`a.iconBg`/`a.iconFg`) | Always the same purple (`#f1eefc`/`#6a5f8a`) for every agent |
| A2 | **Star rating** | Star rating top-right of each card | **Absent** — no `rating` column exists (documented in OPEN-ITEMS.md) |
| A3 | Tool chips font | mono (`class="mono"`) | not mono (plain Geist) |
| A4 | "used on N tickets" stat | purple mono "◍ used on {n} tickets" | "◍ used in N prompts" (tickets usage unavailable pre-Tasks) |

### 🟢 Low
- Icon tile 38px→36px, radius 10→9px; name 14.5→15px; desc color `#57534e`→`#78716c`.
- SYSTEM PROMPT box, TOOLS label, owner footer, "Register a new agent" flow all present. ✅
- Automations tab present per spec. ✅

---

## 9. Brain — `src/app/brain/page.tsx` + `knowledge-card.tsx`

Design source: `Sandbox Brain.dc.html` lines 597–649. Screenshots: `brain-canon.png`. **Conceptually reworked** — the build reskins the existing `knowledge_items` store rather than the designed "canon" model.

### 🔴 High

| # | Element | Design | Implemented |
|---|---|---|---|
| B1 | **Content model** | Editorial **canon**: 4 named categories (Playbooks, Decisions, Standards, Goals) each with icon + blurb + count, grouping entry cards | Flat kind-filter pills (All/Code/Decisions/Documents/Contacts/Archives) + a single 2-col grid. No category grouping, no blurbs. |
| B2 | **Entry freshness** | Each card shows a freshness indicator — green "current" / amber "needs review" dot | Absent. Cards show a kind icon + optional outcome pill (worked/failed/mixed) instead. |
| B3 | **Provenance + reviewer** | Footer: purple mono "◍ from 3 notes · 2 tickets" + reviewer avatar + "reviewed {time} ago" | Footer: kind·project + tags. No provenance, no reviewer, no reviewed-date. |
| B4 | **Stats row** | "18 canon entries · 15 current (green) · 3 need review (amber)" | Only "{n} canon entries" count (top-right of filter row). No current/needs-review breakdown. |

### 🟡 Med / ✅

| # | Element | Design | Implemented |
|---|---|---|---|
| B5 | "Ask the brain" card | gradient `#faf8ff→#fff`, border `#e6ddf5`, ✦ icon, "Ask the brain anything…", ⌘K chip, 3 example pills | ✅ present and faithful — routes to `/search`. Radius 12→13px (minor). |
| B6 | Example-pill color | purple text on `#f2ecfd` (purple-tint) bg | grey `#f4f2ef` bg, `--v2-ink-2` text (not purple) |

**⚑ Design-intent question (B1–B4):** Design's Brain is a *curated canon* (playbooks/decisions/standards/goals, freshness, provenance, reviewers). The build is the *knowledge locker* (code snippets, contacts, files, outcomes) reskinned with the Brain header + ask card. These are different products sharing a name. Which is the real intent — and if the canon model, that's a substantial build.

---

## 10. Growth — `src/app/growth/page.tsx`

Design source: `Sandbox Brain.dc.html` lines 651–670 (**explicit DRAFT stub**). **Intentionally diverged** per HANDOFF task 7b — the team chose to build real metrics instead of the placeholder.

| # | Element | Design (stub) | Implemented | Note |
|---|---|---|---|---|
| GW1 | "DRAFT" badge | purple "DRAFT" pill beside title | removed | intended — page went live |
| GW2 | Funnel | opacity-.55 placeholder funnel (Awareness→Interest→Sign-ups→Activated) with em-dash values | real idea-pipeline funnel (Captured→Validating→Building→Shipped) from live data + 6-week team-hours trend line | intended (task 7b) |
| GW3 | Final stage styling | solid black card | ✅ final "Shipped" stage is black | matches aesthetic |

**Verdict:** not a defect — this is a deliberate upgrade of an admitted stub. Only thing to confirm: the design intended a *marketing* funnel (awareness/interest/sign-ups); the build made an *internal idea-pipeline* funnel. ⚑ *Confirm that's the story you want Growth to tell.*

---

## App Shell — sidebar / topbar — `src/components/shell/*`

Design source: `Sandbox Brain.dc.html` lines 48–102. **Very faithful.**

### 🟡 Med

| # | Element | Design | Implemented |
|---|---|---|---|
| S1 | **Nav item hover** | `.navitem:hover{background:#efece7}` — **solid** | inactive items hover `bg-[#efece7]/50` — **50% opacity** (lighter than design). *(You called out hovers specifically.)* |
| S2 | Nav has **Academy** | 11 items, no Academy | 12 items — Academy inserted between Graph and Growth (the un-designed page). Order otherwise matches the canonical Ideas-file nav. ✅ order |
| S3 | Presence avatar colors | cycles per person: AL blue, SM green, JM neutral | all non-self avatars use the **blue** set only (no green variation) |

### 🟢 Low

| # | Element | Design | Implemented |
|---|---|---|---|
| S4 | Nav item radius / padding / font | radius 8px, padding `7px 9px`, 13.5px | radius 6px (`rounded-md`), padding `8px/6px`, 13px |
| S5 | Nav icons | glyph set (◈ ▦ ⊞ ◷ ❝ ✦ ✎ ◍ ⬡ ↗) | lucide icons throughout (app-wide substitution). Size 16→15px. |
| S6 | Nav list gap | 1px | 2px (`gap-0.5`) |
| S7 | Wordmark gap | 9px | 8px (`gap-2`) |

**Topbar:** height 52px ✓, border `#f0eeeb` ✓, title 14px/600 ✓, search field (340px max, 32px, `#f6f4f1`, radius 9px, ⌘K chip mono 9.5px border `#e2ddd6`) ✓, "N online" + overlapping 24px avatars (-8px) ✓. Faithful. Search `⌕` glyph → lucide Search icon (minor). ✅
**Timer chip:** structure matches spec (green pulse ring, pause/end/resume states, saved toast) per HANDOFF task 2. Not re-audited line-by-line here.

---

## 11. Ideas — `src/app/ideas/page.tsx` + `ideas/[id]/page.tsx` + `idea-editor.tsx`

Design source: `Sandbox Brain Ideas.dc.html` (separate export). Screenshots: `list.png`, `scoring.png`, `02-detail-full.png`.

### List view — 🔴 High

| # | Element | Design | Implemented |
|---|---|---|---|
| I1 | **Lifecycle track** on card | 3-stage track (Draft → Validating → Promoted) — dots joined by a colored progress line, current stage bold-labeled | Replaced by a single **status pill.** The lifecycle visual is gone. |
| I2 | **Scoring sparkline + avg** | Footer: a **7-bar sparkline** (one bar per scoring dimension) + big **"{avg}/5"** score | Only a "{n} of 7 rated" text label. No sparkline, no average score. |
| I3 | Quick-capture + filters | Populated state has a quick-capture bar + stage filter chips (All/Draft/Validating/Promoted/Archived w/ counts) + "Filter ideas" search above the grid | None of these — grid only. (Capture is via a "New idea" dialog instead.) |

### List view — 🟢 Low
- Card grid `auto-fill minmax(292px,1fr)` ✅ exact. Verdict pill + "No verdict" state ✅. "updated {time}" ✅. Title 15.5px ✅.
- Missing purple `◇` icon badge beside the "Ideas" H1.

### Detail view — 🔴 High

| # | Element | Design | Implemented |
|---|---|---|---|
| I4 | **Radar / spider chart** | SVG radar (5 concentric rings + 7 spokes, accent-filled polygon) in the SCORING section | **Absent.** Only the 7 linear bar rows render. |
| I5 | **Click-to-score bars** | Each 5-cell dimension bar is **directly clickable** to set 1–5 (click again to clear) | Bars are **read-only** in view mode; scores edited via **number inputs** in a separate edit mode. |
| I6 | **Verdict as inline pills** | 3 clickable pills (Strong/Conditional/Pass) in the meta strip | Read-only display pill + a `Select` dropdown in edit mode. |
| I7 | **Lifecycle stepper** | 3-step clickable stepper (circles show ✓ done / filled current / hollow future) + ARCHIVED badge | Plain status pill + `Select` dropdown. |

### Detail view — 🟡 Med

| # | Element | Design | Implemented |
|---|---|---|---|
| I8 | Layout | Two-column: main canvas + **300px right rail** (Similar + Related + In the graph) | Single column (`max-w-3xl`); Similar/Related **stacked below** the editor. |
| I9 | Promote banner | Full banner, two states (promoted-green / promotable-purple) with a **two-step confirm** ("Promote to Project" → "Create Project"/"Cancel") | A `PromoteIdeaButton` top-right (verify whether it does the two-step confirm). |
| I10 | Similar ideas | % match + mini similarity bar per result | Title + verdict only (uses `find_similar_ideas` RPC — server-side, vs design's client cosine). Functionally equivalent. |
| I11 | "In the graph" link | "Open this idea in the graph →" footer link | Not present on the detail page. |

### Detail view — ✅ Good
- Title 31px (view) ✅; THE CANVAS 5 Lean-Canvas fields with Solution full-width + italic placeholder hints ✅; Related-ideas linking with chips ✅.

**⚑ Design-intent question (I4–I7):** The Ideas detail is the design's most interactive screen — inline click-to-score bars, a radar chart, clickable verdict pills, and a lifecycle stepper. The build has the *data* (7 scores, verdict, status) but renders it as **read-only displays + a separate edit form**, and drops the radar chart. Do you want the interactive scoring/verdict/lifecycle UI + radar rebuilt, or is the edit-form approach acceptable?

---

## Summary — priorities

### 🔴 Highest-impact gaps (missing/wrong vs design)
1. **Global**: `--background: #white;` is invalid CSS — the cream app-shell background (`#e7e5e0`) is likely not rendering. Quick fix, high visibility. *(G1/G4)*
2. **Home**: filter pills missing, animated "flow" timeline replaced by a static dashed line, entity chips → plain links. The page's signature look is diluted. *(H1–H3)*
3. **Time**: the designed stacked-by-project chart (legend + y-axis + average line) is not built — replaced by a plain bar chart. *(TM1)*
4. **Brain**: built as the knowledge-locker reskin, not the designed canon model (categories/freshness/provenance/reviewers). *(B1–B4)*
5. **Ideas detail**: radar chart + inline click-to-score/verdict/lifecycle UI not built. *(I4–I7)*
6. **Projects**: card lost its completion footer + progress bar + hours; name is serif not sans. *(P1–P4)*
7. **Notes / Graph / Ideas**: all three re-shaped from single-screen multi-pane designs into router list→detail flows (a real product decision, repeated 3×). *(N1, GR3, I8)*

### 🟡 Consistent smaller deltas (worth a global sweep)
- `.font-mono-label` is hardcoded 9.5px; design uses **10px** in most non-sidebar places. *(G3)*
- Glyph icons → lucide icons app-wide (intentional, but a deviation from the exact design marks).
- Nav hover is half-opacity vs design's solid `#efece7`. *(S1)*
- Many cards are 1px off on radius (12↔13) and a few px on font sizes (12.5↔13).

### ⚑ Decisions I need from you (design-intent, not bugs)
- **H11** Home progress bars: completion % or time-share %?
- **P1–P3** Projects card: progress-tile (design) or CRUD-tile (built)?
- **N1** Notes: keep router flow or rebuild 3-pane?
- **B1–B4** Brain: canon model (design) or knowledge-locker (built)?
- **GR3** Graph: rebuild in-canvas node focus + detail panel, or keep filter-and-navigate?
- **TM1** Time: rebuild stacked chart, or keep the dashboard?
- **I4–I7** Ideas: rebuild interactive scoring/radar, or keep edit-form?
- **Academy / Profile**: ⚑ no design exists — you to provide/confirm. Still in development.

### ✅ Pages in good shape
- **Tasks** (board/list/drawer) — closest to design.
- **App shell** (sidebar/topbar/timer) — faithful.
- **Prompts** — close, mostly additive extras.
- **Agents** — close (gaps: per-agent icon color, star rating, mono chips).
- **Growth** — intentionally rebuilt (not a defect).
