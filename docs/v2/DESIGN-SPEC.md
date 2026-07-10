# Sandbox Brain V2 — Design Spec (extracted from Claude Design export)

Source of truth: `Sandbox Brain.dc.html` (main), `Sandbox Brain Ideas.dc.html` (Ideas screen), `Sandbox Brain Directions.dc.html` (intent language only), plus latest-numbered files in `screenshots/`. Where CSS and screenshots disagree, CSS in the `.dc.html` wins and is noted.

Status: COMPLETE.

---

## 1. Design Tokens

### 1.1 Color palette (exact values from CSS, `Sandbox Brain.dc.html`)

**Backgrounds / surfaces**
- App background (outer body): `#e7e5e0`
- Main canvas background (white shell): `#fff`
- Sidebar background: `#fafaf9`
- Sidebar border (right edge): `#ededeb`
- Topbar border (bottom): `#f0eeeb`
- Search field background (topbar): `#f6f4f1`
- Right rail / secondary panel background: `#fdfcfb` (used for Home right rail, Notes list panel, Notes backlinks panel, Graph detail panel)
- Task board column background: `#faf9f7`
- Task board column border: `#f0eeeb`
- Task card background: `#fff`
- List view header row background: `#faf9f7`
- List row divider: `#f4f2ef`
- Generic border (cards, panels): `#ededeb`
- Graph canvas background: `radial-gradient(circle at 50% 44%, #ffffff 0%, #faf9f7 62%, #f4f2ee 100%)`

**Ink / text tiers**
- Primary text: `#1c1c1f`
- Body/secondary text: `#78716c`
- Tertiary/muted text (meta, timestamps): `#a8a29e`
- Quaternary/faint text (placeholders, empty states): `#c4c1ba`
- Label/eyebrow text (mono uppercase labels like "WORKSPACE", "FLOWING NOW"): `#b5b3ad`
- Row secondary text (e.g. status column in list): `#78716c`
- Scrollbar thumb: `#d6d3cd`

**Accent (primary brand/interactive)**
- Accent purple: `#5b3fd6` (links, wikilinks, claimed-link icons, "Open note →", "Open this note in the graph →")
- Accent purple hover: `#4a2fc0`
- Wikilink underline: `#cdc6f0`; wikilink hover background: `#efe9ff`

**Semantic colors**
- Success/positive (green): text `#3f7a56`, bg `#eef6f0`, border `#cfe6d8` — used for "Claimed by you", saved toast, timer resume button `#22c55e`
- Warning/conflict (orange): icon/text `#c2410c`, deeper text `#9a4a1e`, bg `#fdf3ec`, border `#f0d6c0` — conflict banner + ⚠ icon
- Locked/neutral-warm (tan/brown): text `#8a6a4a`, bg `#f7f4f1`, border `#e6ddd4` — "Locked by {name}" state
- Danger/end-timer button: icon color `#b0442e` on white bg with `#e2ddd6` border
- Live "recording" ring pulse: `#22c55e` (green, animated ring keyframe)

**Avatar colors (people chips, initials)**
- Blue set: bg `#cdd4ea`, fg `#4a5b8a` (e.g. "AL")
- Green set: bg `#c3ddca`, fg `#3f7a56` (e.g. "SM")
- Neutral set: bg `#e7e5e0`, fg `#57534e` (e.g. "JM" — the current user, John Milius)

**Graph node type colors (legend, bottom-left of Graph canvas)**
- NOTES: `#4a5b8a` (blue)
- PROMPTS: `#8a6a2a` (gold/brown)
- PROJECTS: `#1c1c1f` (black)
- PEOPLE: `#3f7a56` (green)
- AGENTS: `#6a5f8a` (purple-grey)

**Priority dot colors** (task cards/list — exact hex not in static markup, driven by data binding `t.priColor`; values not enumerated in CSS, only the binding slot exists — see Ambiguities).

**Overlay/scrim**
- Slide-over backdrop: `rgba(28,28,31,.28)`
- Slide-over shadow: `-12px 0 40px -18px rgba(0,0,0,.4)`

### 1.2 Typography

Three font families loaded via Google Fonts:
```
Geist:wght@400;500;600;700
Geist+Mono:wght@400;500
Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400
```

- **Geist** — default body/UI font (`body{font-family:'Geist',system-ui,sans-serif}`). Used for nearly all UI chrome: sidebar nav, buttons, labels, card text, table cells, topbar title.
- **Geist Mono** (class `.mono`) — used for: eyebrow/section labels (e.g. "WORKSPACE", "FLOWING NOW", "ACTIVE PROJECTS", "TIME LOGGED", "LINKED FROM", "IN THE GRAPH", "CONNECTED TO"), timestamps/metadata (`{{ f.meta }}`, `edited {{ noteEdited }}`), timer readout (`{{ timerText }}`), ticket IDs (`{{ t.id }}`, `{{ dId }}`), numeric stats ("142 connections", "18.5h total"), table column headers in list view, keyboard shortcut chip "⌘K", day labels in week bar chart, graph type-legend labels.
- **Newsreader** (serif, used sparingly as *display* font) — used for: page/greeting headline on Home (`{{ greeting }}, John`, 29px), note title in editor (30px, contenteditable), Graph canvas title "The graph" (24px), Graph detail panel node label (23px), Projects page heading (26px), Tasks page heading (26px), ticket detail slide-over title (23px). This is the editorial "display" voice — every major view's H1 is Newsreader serif, italics available (`ital` axis loaded) though not clearly used in visible markup.

**Type scale actually used (size / weight / line-height / family), in ascending order:**
| Size | Weight | Family | Usage |
|---|---|---|---|
| 9px | 400 | mono | week-bar chart values (smallest mono label) |
| 9.5px | 400/500 | mono | letter-spaced eyebrow labels (`.14em` tracking), day labels |
| 10px | 400 | mono | metadata, badges, checklist/link counts, graph legend |
| 10.5px | 400 | mono/geist | note snippet edited date, list ID column, list status text |
| 11px | 400 | geist/mono | body meta text, feed meta, conflict banner text |
| 11.5px | 400/500 | geist | filter pills, empty state text, "No tickets" |
| 12px | 400/500 | geist | tab pills (Board/List), task tab filters |
| 12.5px | 400/500 | geist | sidebar nav items, connected-node rows, claimed/locked banner text, backlink title |
| 13px | 400/500 | geist | note list title, list-view ticket title |
| 13.5px | 400/600 | geist | feed text, Home subtitle summary |
| 14px | 500/600 | geist | topbar page title, "Sandbox Brain" wordmark |
| 14.5px | 600 | geist | (wordmark container font-size context) |
| 15px | 400 | geist | note editor body copy (line-height 1.85) |
| 23px | 400 | Newsreader | ticket detail title, graph detail node label |
| 24px | 400 | Newsreader | Graph canvas title "The graph" |
| 26px | 400 | Newsreader | Projects / Tasks page H1 |
| 29px | 400 | Newsreader | Home greeting H1 |
| 30px | 400 | Newsreader | note editor title (contenteditable) |

Letter-spacing: mono eyebrow labels use `letter-spacing:.14em` (or `.1em`/`.06em` variants) with `text-transform:uppercase` in some cases (list header, board column name). Display serif headings use `letter-spacing:-.01em` (tightened).

### 1.3 Border radii
- Small chips/badges: `4px`–`6px` (kbd chip, area tag)
- Pills (filters, tabs, status pills): `14px` (full pill) or `6px`–`8px` (segmented tab buttons)
- Standard control/button radius: `7px`–`9px` (nav items, icons, avatar-adjacent buttons, search field)
- Card radius: `10px`–`13px` (task cards `10px`, note rows `9px`, project cards `13px`, backlink cards `10px`)
- Board column radius: `12px`
- List container radius: `12px`
- Avatars: `50%` (circular)
- Timer dot: `50%` circular, 9px

### 1.4 Spacing patterns
- Sidebar padding: `18px 13px`
- Topbar height: `52px` fixed, horizontal padding `0 26px`
- Main content padding: `30px 34px` (Home, Projects, Tasks header)
- Right-rail/side-panel padding: `30px 22px` or `26px 22px`
- Note editor padding: `34px 40px`, max-width `680px`
- Card internal padding: `11px 12px` (task card), `20px 22px` (project card)
- Nav item padding: `7px 9px`
- Gap conventions: `2px` tight stacks (nav list), `4-9px` inline icon+label gaps, `14-16px` section gaps, `24-30px` major section separation

### 1.5 Shadows
- Task card hover: `0 4px 14px -4px rgba(0,0,0,.16)` + `translateY(-1px)` on `.tcard:hover`
- Task card resting: `0 1px 2px rgba(0,0,0,.04)`
- Slide-over drawer: `-12px 0 40px -18px rgba(0,0,0,.4)`
- No shadows on flat cards/rows elsewhere — the design relies on 1px borders (`#ededeb`/`#f0eeeb`) rather than elevation for most separation.

### 1.6 Dark mode
No dark-mode handling present. `body{background:#e7e5e0}` is a single hardcoded light value; no `prefers-color-scheme` media query, no CSS custom properties/theming layer, no dark tokens anywhere in the `.dc.html` files. All screenshots are light-only. **Confirmed: this design is light-mode only; dark mode is not specified anywhere and would need to be designed from scratch.**

---

## 2. App Shell Spec

### 2.1 Sidebar (`width:224px`, bg `#fafaf9`, right border `#ededeb`, padding `18px 13px`)
- **Wordmark row**: 26×26px black rounded-square icon (`◨` glyph, white on `#1c1c1f`, radius 7px) + "Sandbox Brain" text, weight 600, 14.5px.
- **"WORKSPACE" eyebrow label**: mono, 9.5px, `.14em` tracking, color `#b5b3ad`.
- **Nav list** (single-select, active state = bg `#efece7`, fg `#1c1c1f`, icon `#78716c`, weight 500; inactive = transparent bg, fg `#57534e`, icon `#c4c1ba`, weight 400). Exact order and icons (glyph characters, not an icon library — likely placeholders for a real icon set):
  1. Home — `◈`
  2. Projects — `▦` — badge "3"
  3. Tasks — `⊞` — badge = count of tickets assigned to current user (JM) that are not done (dynamic, e.g. "2"; renders empty string if 0)
  4. Time — `◷` — badge "18.5h"
  5. Prompts — `❝`
  6. Agents — `✦`
  7. Notes — `✎`
  8. Brain — `◍`
  9. Graph — `⬡`
  10. Growth (marketing) — `↗` — no badge (has a "DRAFT" tag on the page itself)
  - Badges are right-aligned mono 10px `#b5b3ad`.
- **Live timer chip** (bottom of sidebar, above user row): white card, 1px border `#ededeb`, radius 9px, padding `9px 10px`.
  - Status dot (9px circle): green `#22c55e` + animated pulsing ring (`ring` keyframe, 1.8s ease-out infinite, scale .8→2.4 opacity .55→0) when running; amber `#e0a53f` when paused (no ring).
  - Timer readout: mono, 14px, weight 500 (`HH:MM:SS` format via `fmt()`).
  - Task label under timer: current tracked task name, e.g. "Ramp landing page" — 10.5px `#a8a29e`, truncated with ellipsis.
  - **Running state**: single pause button (28×28px black rounded square, `❚❚` glyph).
  - **Paused state**: two buttons — End & save (28×28px white, red icon `#b0442e`, border `#e2ddd6`, `■` glyph, tooltip "End & save to time log") and Resume (28×28px green `#22c55e`, `▶` glyph).
  - **Saved toast**: appears after ending timer, auto-dismisses after 3.2s. Green success style (bg `#eef6f0`, border `#cfe6d8`, text `#3f7a56`), checkmark + "Saved {h}h {m}m to your time log".
- **User row**: 24×24px circular avatar (initials "JM", bg `#e7e5e0`, fg `#57534e`) + name "John Milius", 12.5px, color `#57534e`.

### 2.2 Topbar (`height:52px`, bottom border `#f0eeeb`, padding `0 26px`)
- **Page title**: left-aligned, bound to active nav item's label, 14px weight 600.
- **Global search field**: `flex:1;max-width:340px;height:32px`, bg `#f6f4f1`, radius 9px, padding `0 11px`, placeholder "Search the brain…" in `#a8a29e` 12.5px with a `⌕` search glyph prefix, and a right-aligned `⌘K` keyboard-shortcut chip (mono 9.5px, 1px border `#e2ddd6`, radius 4px, padding `1px 5px`).
- **Presence indicator**: "3 online" mono label (11px, `#a8a29e`) followed by 3 overlapping circular avatars (24px, `-8px` negative margin overlap): AL (blue `#cdd4ea`/`#4a5b8a`), SM (green `#c3ddca`/`#3f7a56`), JM (neutral `#e7e5e0`/`#57534e` — the current user, always last/frontmost).

### 2.3 Content container
- Main flex column, `flex:1;overflow-y:auto`.
- Typical page padding: `30px 34px`.
- Typical page max-width: `840px`–`900px` for text-heavy/list pages (Brain, Prompts, Agents, Time, Marketing); Home/Notes/Graph/Tasks are full-bleed multi-column layouts (no max-width cap — they use fixed-width side panels instead, e.g. 262px/270px/250px right rails).
- No responsive/narrow-width breakpoints, media queries, or mobile layout anywhere in the CSS — the shell assumes a fixed desktop viewport (design canvas is `1180×720` per the `$preview` prop). **Narrow-width behavior is not designed at all** — see Ambiguities.

---

## 3. Per-Screen Specs

Note on navigation discrepancy: the **main file's** `NAV` array (10 items, no Ideas) and the **Ideas file's** local `NAV` array (11 items, Ideas inserted at position 3, after Projects and before Tasks) are two different literal arrays — the Ideas screen was designed in a separate export and never merged back into the main file's nav. Final app must reconcile into a single 11-item nav. Order per the Ideas file (more complete): Home, Projects, Ideas, Tasks, Time, Prompts, Agents, Notes, Brain, Graph, Growth.

### 3.1 Home (digest) — `isHome`
**Evidence**: `Sandbox Brain.dc.html` lines 106-175; no dedicated screenshot found (not in the 30 screenshots — see Ambiguities), but fully specified in CSS/JS.
- Two-column layout: main feed (flex:1, padding `30px 34px`) + right rail (`262px` fixed, bg `#fdfcfb`, left border).
- **Header**: Newsreader serif greeting "{{ greeting }}, John" (29px) e.g. "Good morning, John", right-aligned mono date "MON · JUL 6". Subtitle below in `#78716c` 13.5px, dynamic per active filter (e.g. "Six things moved through the brain since you left.").
- **"FLOWING NOW" section**: mono eyebrow label + 3 filter pills (All / Mine / Ramp — project-specific pill is dynamic) with active state = black bg/white text, inactive = `#f4f2ef` bg/`#78716c` text.
- **Activity feed**: vertical timeline with a static dashed-line rail (animated flowing dash effect via `flowSlow` keyframe, togglable by `animateFlow` prop) and per-item colored dot (matches actor color). Each entry: `**Actor** verb [chipA] → [chipB]` sentence construction with colored chips per entity kind (note/prompt/project/brain — each has its own bg/fg pair), plus a mono meta line ("14m ago · +1 backlink"). Actors: named people (colored by identity) or "Digest agent" (purple, automated).
- **Right rail — "ACTIVE PROJECTS"**: mono eyebrow + up to 3 projects, each with name, percentage-complete mono label, and a 5px-tall progress bar (black fill on `#efece7` track). Clicking navigates to Tasks scoped to that project.
- **Right rail — "TIME LOGGED"**: mono eyebrow + "18.5h total" mono stat, subtitle copy, then a 7-bar weekly mini bar-chart (height 66px) with per-day value labels above bars and day-letter labels below; today's bar highlighted in black, others in `#e7e5e0`. Footer caption calls out today as busiest day.

### 3.2 Notes — `isNotes`
**Evidence**: lines 177-225; no distinct screenshot captured for this view specifically (Notes nav item visible in all sidebar shots but the editor content itself isn't in the screenshot set).
- Three-column layout: note list (270px, bg `#fdfcfb`) + editor (flex:1, max-width 680px content) + backlinks rail (250px, bg `#fdfcfb`).
- **Note list**: "ALL NOTES · {count}" eyebrow + "+" add button. Each row: title (weight varies selected/not) + relative-edited mono timestamp, 2-line clamped snippet (wikilink brackets stripped for preview), and a colored `#tag` (color keyed by tag: `#marketing`=purple, `#strategy`=green, `#product`=blue, `#project`=gold).
- **Editor**: mono tag label, contenteditable Newsreader title (30px), "edited {time} · {n} links" meta line, then contenteditable body (15px, line-height 1.85) with **inline wikilinks** — `[[Title]]` syntax parsed into clickable purple spans (`.wlink` class, underline `#cdc6f0`, hover bg `#efe9ff`) that navigate to the linked note.
- **Backlinks rail**: "◍ LINKED FROM" list of notes that reference the current note (title + truncated context snippet) — empty state: "No other notes link here yet." Below that, "◷ IN THE GRAPH" section with an "Open this note in the graph →" link to jump to the Graph view focused on this node.
- Seed data: 4 interconnected notes (Positioning v3, Growth, Onboarding idea, Ramp plan) forming a small linked graph — this is the same dataset that feeds the Graph view.

### 3.3 Graph — `isGraph`
**Evidence**: lines 227-272; screenshots `03-graph-physics.png` (latest of the physics series), `02-graph-redo.png` (latest of the redo series), `graph-current.png`.
- Full-bleed force-directed node graph (Obsidian-style), draggable nodes, live physics simulation (repulsion + spring edges + centering, stepped every 33ms via `stepPhysics()`).
- Canvas background: radial gradient white→`#faf9f7`→`#f4f2ee`. Title overlay top-left: "The graph" (Newsreader 24px) + "142 connections · drag the nodes around" (12.5px `#78716c`).
- Two concentric focus rings drawn around the currently-selected node (radii 190px/290px, subtle `#eae5dd`/`#f1ede6` strokes) — a "spotlight" effect.
- **Nodes**: circle size scales with node degree (`26 + deg*2.6px`, +8px if selected); each has a type icon (note `✎`, prompt `❝`, project `▦`, person `☺`, agent `✦`) and a label below. Three visual states: selected (solid type-color fill, white icon, glow shadow), connected-to-selected (tinted fill, colored border, colored icon), and unrelated (dimmed grey, opacity 0.55).
- **Edges**: SVG paths, accent-colored + thicker (1.8px, opacity .65) when touching the selected node, otherwise grey (`#cfc9c0`, 1.1px, opacity .32).
- **Legend** (bottom-left, mono): 5 colored dots for NOTES (blue) / PROMPTS (gold) / PROJECTS (black) / PEOPLE (green) / AGENTS (purple).
- **Detail panel** (270px right rail): node type label (colored), Newsreader node label (23px), connection count, "CONNECTED TO" list of linked node labels (colored dots, clickable to re-focus), and if the node is a note, an "Open note →" link into the Notes view.
- Seed graph: 7 nodes (Ramp project as hub, Positioning v3, Cold email prompt, Growth note, Sam, Digest agent, John), 9 edges.

### 3.4 Projects — `isProjects`
**Evidence**: lines 274-291; no dedicated screenshot in the set (inferred from CSS + Home right-rail click-through).
- Simple 2-column grid of project cards (max-width 840px), each: icon tile (▦), hours-logged mono stat, project name, description, "{pct}% · {done}/{total} tasks done" mono stat + people list, progress bar. Clicking navigates into Tasks scoped to that project.
- Header: "Projects" Newsreader 26px + "3 active · click a project to open its tasks." subtitle.

### 3.5 Tasks — board + list + detail drawer — `isTasks`
**Evidence**: lines 293-445; screenshots `02-tasks-board.png` (board+drawer), `tasks-list-clean.png`/`tasks-list.png` (list+drawer).
- **Toolbar**: Newsreader "Tasks" H1 (26px) + subtitle "Claim a ticket to lock it to you · overlaps are flagged to avoid merge conflicts." Right side: Board/List segmented toggle (pill-style, white active tab) + black "+ New ticket" pill button.
- **Project filter tabs**: pill row — "All projects" + one pill per project ("Ramp landing", "Sidequest v2", "Warehouse sim"); active = black bg.
- **Board view**: horizontally-scrollable 5-column kanban (Backlog / To do / In progress / Review / Done), each column `236px` wide, bg `#faf9f7`, header shows name (uppercase mono) + count badge. Empty columns show "No tickets" in light grey.
  - **Task card** anatomy: priority dot (colored) + title (2-line), area tag pill + mono ticket ID + optional `⚠` conflict icon (with tooltip), then a footer row: assignee avatar (or 🔒+claimer name if locked by someone else) on the left, checklist progress (`☑ 2/3`) and link count (`◍ 1`, purple) right-aligned. Hover: card lifts with shadow.
- **List view**: single flat table (max-width 900px) with columns ID / Ticket (priority dot + title + conflict icon) / Status / Area / Owner. Header row uppercase mono `#b5b3ad` on `#faf9f7` bg.
- **Ticket detail drawer**: right-side slide-over, 396px wide, slides in with `slideover` cubic-bezier animation, dimmed backdrop. Contents top to bottom:
  1. Header: mono ticket ID + project name, close (✕) button.
  2. Newsreader title (23px).
  3. **Conflict warning banner** (if applicable) — orange bg `#fdf3ec`, `⚠` icon, text "Heads up — {name} is also working in {area}. Coordinate to avoid a merge conflict."
  4. **Claim/lock state** — one of three mutually exclusive blocks: unclaimed (black "🔓 Claim this ticket" full-width button), claimed-by-me (green bar "✓ Claimed by you" + underlined "Release" link), locked-by-other (tan bar "🔒 Locked by {name} — can't edit until released", disables status/checklist interactions).
  5. **Meta row**: Priority (colored dot + label), Area (pill), Owner (avatar + name) side by side.
  6. **Status**: row of 5 pill buttons (one per COLS status), active = black; disabled/not-allowed cursor when locked by another user.
  7. **Checklist**: rows with custom checkbox (black filled + ✓ when done, strikethrough text), empty state "No checklist items yet."
  8. **"◍ LINKED IN THE BRAIN"**: rows linking to Notes or Prompts, each with a type-colored label + title + arrow, empty state "Not linked to anything yet."
  9. Optional live-viewer indicator: "👁 {name} is viewing this now".

### 3.6 Time — `isTime`
**Evidence**: lines 448-511; no dedicated screenshot in set.
- Max-width 860px page. Header "Time" (Newsreader 26px) + "Team logged 18.5h this week · you 6.2h." subtitle.
- **Weekly stacked bar chart**: bordered card, legend (colored squares per project: Ramp=black, Sidequest=accent purple, Warehouse=sage `#b7cfc0`), y-axis gridlines (0/2/4/6h), a dashed **average line** annotated "avg {x}h", and 7 stacked bars (segments per project, rounded top corners, today's bar in solid black with a drop shadow, others `#e7e5e0`). Day labels below.
- **Time entries list**: bordered card, rows of avatar + task name + project (mono) + hours (mono, right-aligned).

### 3.7 Prompts library — `isPrompts`
**Evidence**: lines 513-528; screenshot `02-fixed-views.png` shows this rendering correctly; `prompts-check.png` appears to be a broken/empty capture of the same screen (content area blank — likely a stale iteration or scroll/render glitch, not a real empty state).
- Max-width 840px. Header "Prompt library" (Newsreader 26px) + "Reusable prompts, rated by the team." subtitle.
- List of bordered cards: title (14px weight 600) + right-aligned star rating (`★★★★☆` glyph string in gold `#e0a53f`, 12px), 2-line description body, mono footer "#tag · saved by {author}".
- Star ratings are rendered as literal star-glyph strings (not an interactive component) — e.g. "★★★★☆" for a 4/5 rating; not clear if these are user-clickable in the intended product (see Ambiguities).

### 3.8 Agents — `isAgents` (Dev agents tab + Automations tab)
**Evidence**: lines 530-595; screenshots `02-agents-registry.png` (shows Automations tab active — confusingly this file is named "agents-registry" but the visible tab is Automations), `01-agents-registry.png` superseded.
- Segmented Dev agents / Automations toggle top-right; subtitle changes per tab.
- **Dev agents tab**: 2-column grid of bordered cards, each: icon tile (colored per agent) + name + model (mono, e.g. "Claude Sonnet 4.5" / "Claude Opus 4") + star rating top-right; description; "TOOLS & ACCESS" mono label + wrapped tag chips (e.g. "GitHub", "ESLint", "repo read"); a nested "SYSTEM PROMPT" box (bg `#faf9f7`) showing an italicized 2-line-clamped excerpt of the agent's system prompt; footer: owner avatar + name, right-aligned "◍ used on {n} tickets" purple mono stat. Trailing dashed-border "+ Register a new agent" placeholder card.
- **Automations tab**: bordered list of rows — icon (⚙, purple tile), name + description, right-aligned schedule (mono, e.g. "Fri · 5pm") + last-run (mono, lighter), and a status pill (colored dot + label: Active=green, Warning=amber, Paused=grey).
- Seed data: 4 dev agents (Code Reviewer, Test Writer, Frontend Scaffolder, Bug Triager) and 4 automations (Weekly digest, Link suggester, Idle project nudge, Prompt curator).

### 3.9 Brain (canon/KB) — `isBrain`
**Evidence**: lines 597-649; screenshots `brain-canon.png` / `brain-lower.png` / `brain-lower2.png` (all show the same scroll position/state — no distinct "lower" content actually visible, likely near-duplicate captures).
- Max-width 840px. Header "The brain" (Newsreader 26px) + "The team's canon — durable knowledge promoted out of the daily churn, kept current." subtitle.
- **"Ask the brain" search card**: gradient bg card (`linear-gradient(180deg,#faf8ff,#fff)`, purple-tinted border `#e6ddf5`), search-style input "Ask the brain anything…" with `✦` icon + `⌘K` chip, followed by 3 example-question pill chips ("How do we run a launch?", "Why did we pick our stack?", "What's our voice?").
- **Stats row**: "18 canon entries" + "15 current" (green dot) + "3 need review" (amber dot) mono stats.
- **Categorized canon list**: 4 categories (Playbooks ▶ blue, Decisions ◈ purple, Standards ▤ gold, Goals ◎ green), each with an icon, name, count badge, and blurb, containing a 2-col grid of entry cards. Each entry card: title + freshness indicator (colored dot + "current"/"needs review" label, green `#3f9b6c` vs amber `#e0a53f`), 2-line summary, footer: purple mono provenance stat ("◍ from 3 notes · 2 tickets") + right-aligned reviewer avatar + "reviewed {time} ago".

### 3.10 Growth (Marketing) — `isMarketing` — STUB/PLACEHOLDER
**Evidence**: lines 651-670; no dedicated screenshot in set.
- Explicitly marked as a draft/placeholder: header "Growth" + a purple "DRAFT" badge pill. Subtitle: "Marketing surface — placeholder. Metrics to be defined with the growth lead."
- Contains one dashed-border example card: "EXAMPLE FUNNEL · REPLACE WITH REAL METRICS" mono label, a 4-stage funnel visual (Awareness → Interest → Sign-ups → Activated, purple-tinted gradient boxes with em-dash placeholder values, final stage in solid black), all at `opacity:.55` to signal non-functional/mock. Explanatory paragraph confirms this tab has no real design yet — it's a shell awaiting requirements from a "growth lead." **This confirms Growth/Marketing is intentionally undesigned — treat as an explicit gap, not an oversight.**

### 3.11 Ideas (separate file: `Sandbox Brain Ideas.dc.html`)
**Evidence**: full file read (744 lines); screenshots `list.png` (grid list view), `scoring.png`/`02-detail-full.png` (detail view, duplicates).

**List view** (`isList`):
- Header: "Ideas" (Newsreader 29px) + purple `◇` icon badge + subtitle "Raw concepts, fleshed out over time. Capture first — decide later." Top-right: a demo-only toggle link "⎋ view empty state" (dev/QA affordance, not a real product feature — swaps in the empty state below).
- **Empty state** (`isEmpty`): centered, 64px icon tile, Newsreader "No ideas captured yet" (26px), explanatory copy, an inline **quick-capture card** (title input 18px + optional one-line-pitch input + "Capture idea →" button, disabled/grey until a title is typed) with 3 seed-prompt pill suggestions ("What problem keeps coming up?", etc.) that pre-fill the title field.
- **Populated state**: quick-capture bar (compact horizontal version of the same, inline "Add" button) sits above a filter row: stage chips (All/Draft/Validating/Promoted/Archived, each with a count) + a right-aligned "Filter ideas" search box.
- **Card grid** (default `listLayout:'grid'`, alt `'rows'` table view driven by a design prop): responsive `auto-fill minmax(292px,1fr)` grid. Card anatomy: verdict pill (colored dot + label: Strong/Conditional/Pass/No verdict) + mono "updated {time}" top-right; title (15.5px) + 2-line tagline; a **3-stage lifecycle track** (Draft → Validating → Promoted, dots connected by colored progress line, current stage bold-labeled); footer: a 7-bar sparkline (one per scoring dimension, height proportional to score, accent color if rated else grey) + big "{avg}/5" score + "{n} of 7 rated" mono caption; optional meta row (promoted-to-project link in green, "◍ {n} related" count, "⎘ {domain}" source link).
- **Rows (alt) layout**: table with columns IDEA (title+tagline) / VERDICT / LIFECYCLE (dot+label) / SCORE (mini sparkline+avg) / UPD (relative time).
- Filtered-empty state: centered `◇` glyph + "No ideas match "{query}"." or "Nothing in {stage} yet."

**Detail view** (`isDetail`):
- Breadcrumb topbar: "‹ Ideas /" back-link + idea title as page title (replaces global search field's normal position context).
- Two-column: main canvas (flex:1) + right rail (300px, similar/related ideas).
- **Header**: contenteditable Newsreader title (31px) + contenteditable tagline, right-aligned Edit/Done mode toggle button (toggles all canvas fields + verdict/lifecycle/source between editable and read-only rendering).
- **Meta strip** (bordered-bottom row): 
  - VERDICT — 3 clickable pills: Strong (green), Conditional (amber), Pass (red) — plus an implicit 4th "No verdict"/unset state before any is picked.
  - LIFECYCLE — 3-step clickable stepper (Draft → Validating → Promoted), circles show ✓ when done, filled+colored when current, hollow when future; "ARCHIVED" grey badge appended if archived.
  - SOURCE — optional URL field (edit: text input; view: domain-only display, purple if set, else "None"), plus an "archive"/"↩ restore" toggle link (turns red on hover).
- **Promote banner**: two states — already promoted (green "Promoted to a Project" banner, "This idea became **{name}** — kept here as its origin record.", "View project →" link) or promotable (purple "Ready to build this for real?" banner with a "Promote to Project" button that requires a second confirm step "Create Project"/"Cancel" — this is a genuine two-step confirmation pattern, not a stub).
- **"THE CANVAS" — Lean Canvas fields**: 5 fields in a 2-col grid (Problem, Customer, Solution [full-width], Revenue model, Stack notes), each contenteditable in edit mode; view mode shows italic placeholder hint text (e.g. "What is broken today?") when empty, plain text otherwise.
- **"SCORING · 7 DIMENSIONS"**: a radar/spider chart (SVG, 5 concentric rings + 7 spokes, accent-filled polygon) paired with 7 individual dimension rows (Problem, Market, Revenue, Moat, Distribution, Build, Team fit), each row a horizontal 5-cell bar that's directly clickable to set a 1–5 score (click same value again to clear it — toggle-off supported), plus a numeric value readout. Overall average shown top-right of this section, color-coded by score band (≥4 green, ≥3 accent, ≥2 amber, <2 red).
- **Right rail — "◇ SIMILAR IDEAS"**: auto-computed via a real client-side cosine-similarity/bag-of-words algorithm (`tokenize()`/`cosine()` methods) over title+tagline+problem+customer text — top 3 matches above a 0.02 similarity threshold, each shown as a card with % match and a mini similarity bar. Empty state prompts to add more detail.
- **Right rail — "◍ RELATED IDEAS"**: manually curated, bidirectional linking via a type-ahead search box (dropdown results, click to link); linked ideas shown as removable chips (✕ to unlink). Empty state: "No linked ideas yet."
- **"◷ IN THE GRAPH"** footer link: "Open this idea in the graph →" (same graph-integration pattern as Notes).

Seed data: 5 ideas (Coldset—promoted/strong, Warehouse Copilot—validating/conditional, Streaklet—draft/unset with several null scores, Merge Warden—validating/conditional, Campus—archived/pass-verdict-labeled-as-rejected). Note "Merge Warden" is itself an idea about solving merge conflicts — thematically mirrors the Tasks feature's claim-lock/conflict system, evidence the two features share design DNA.

---

## 4. Tasks Feature Data Model (implied by design + component state)

Extracted directly from the `Component` class state/getters in `Sandbox Brain.dc.html` (lines ~692-886).

| Field | Values / format | Evidence |
|---|---|---|
| `id` (ticket ID) | Format `{PROJECT-PREFIX}-{number}`, e.g. `RMP-14`, `RMP-15`, `SQ-31`, `WH-11`. Prefix derived from project name (Ramp→RMP, Sidequest→SQ, Warehouse→WH). Not globally sequential — per-project counters. | `tickets` array; board/list card `t.id`; detail drawer `dId` |
| `title` | Free text, e.g. "Hero section responsive layout" | same |
| `project` | One of 3 seeded projects: "Ramp landing", "Sidequest v2", "Warehouse sim" | `PROJECTS` getter + `tickets[].project` |
| `priority` | 3 levels: `high` (label "High", color `#b0442e` red), `med` (label "Med", color `#e0a53f` amber), `low` (label "Low", color `#a8a29e` grey) | `PRIO` getter |
| `area` | 4 tags: `frontend` (fg `#4a5b8a`/bg `#eef1f8`), `backend` (fg `#3f7a56`/bg `#eef6f0`), `design` (fg `#6a5f8a`/bg `#f1eefc`), `copy` (fg `#8a6a2a`/bg `#f8f1e6`) | `AREA` getter |
| `status` | 5-column set, in order: `backlog` ("Backlog"), `todo` ("To do"), `inprogress` ("In progress"), `review` ("Review"), `done` ("Done") | `COLS` getter; matches board columns 1:1 |
| `assignee` | One of 3 people (`JM`=John, `SM`=Sam, `AL`=Alex) or `null` (unassigned) — rendered as circular initials avatar | `PEOPLE` getter, `t.assignee` |
| `claimedBy` | Separate from assignee — nullable person key. Drives the lock/claim UI. Can differ from assignee (e.g. done tickets keep `assignee` but clear `claimedBy`) | `tickets[].claimedBy`, claim/release logic |
| `viewers` | Array of person keys currently viewing the ticket (presence). Drives "{name} is viewing this now" in detail drawer | `tickets[].viewers`, `dHasViewers`/`dViewerName` |
| `links` | Array of `{type, label, to}` — type is `'note'` or `'prompt'`; links out to Notes or Prompts view. Rendered under "◍ LINKED IN THE BRAIN" | `tickets[].links`, `dLinks` |
| `checklist` | Array of `{t: text, done: boolean}` — free-form per-ticket checklist, can be empty | `tickets[].checklist`, `dChecklist` |
| Conflict / overlap warning | Computed, not stored: any two tickets in the **same project + same area + status `inprogress`** trigger a conflict flag on both. Card shows `⚠` icon (orange `#c2410c`) with tooltip "Same area as {name} · {ticketId}"; detail drawer shows a full banner: "Heads up — {name} is also working in {area}. Coordinate to avoid a merge conflict." | `overlapAreas()`, `isOverlap()`, `overlapPartner()` methods |
| Lock state | Derived from `claimedBy`: unclaimed → "🔓 Claim this ticket" button (black, full-width); claimed by me → green "✓ Claimed by you" bar with "Release" link; claimed by other → tan "🔒 Locked by {name} — can't edit until released" bar that also disables status buttons and checklist clicks (cursor `not-allowed`) | `dUnclaimed`/`dMineClaim`/`dLockedByOther`, `claimTicket`/`releaseTicket` |

**Views**: Board (kanban, 5 columns, horizontally scrollable) and List (single flat table: ID / Ticket+priority dot+title+conflict icon / Status / Area / Owner), toggled via a segmented control. Filterable by project via a pill-tab row ("All projects" + one pill per project). "+ New ticket" button top-right (black pill). Ticket detail opens as a right-side slide-over drawer (396px wide, backdrop dim `rgba(28,28,31,.28)`), not a separate route/page.

Seed data: 16 tickets total across 3 projects, giving realistic distribution across all 5 statuses (evidence for column emptiness handling too — `col.empty` renders "No tickets" in `#c4c1ba`).

---

## 5. Ambiguities & Gaps

| # | Item | Evidence it's unresolved | Recommended resolution |
|---|---|---|---|
| 1 | **Nav list mismatch** — main file has 10 items (no Ideas); Ideas file has 11 items (Ideas inserted 3rd, after Projects). Ideas file nav badge shows active-idea-count ("3"); main file has no Ideas badge logic at all. | Two different literal `NAV` arrays in the two `.dc.html` exports, never reconciled | Adopt the Ideas file's 11-item order as canonical (it's the more complete/later version): Home, Projects, Ideas, Tasks, Time, Prompts, Agents, Notes, Brain, Graph, Growth. Badge = count of ideas in draft/validating status. |
| 2 | **No Home screenshot** — the Home/digest view is fully specified in CSS/JS but not captured in any of the 30 screenshots. | Absent from `screenshots/` | Not a blocker (CSS is complete and unambiguous), but flag for a visual QA pass once built — the flowing-dashed-line timeline animation and stat right-rail are easy to get subtly wrong without a visual reference. |
| 3 | **No Notes, Projects, or Time screenshots** either — same situation as Home: CSS/JS complete, no screenshot to cross-check. | Absent from `screenshots/` | Same as above — build from CSS spec, budget a design review pass against the live build. |
| 4 | **Broken/empty `prompts-check.png`** — shows the Prompts nav item active but a completely blank content pane, while `02-fixed-views.png` (same screen, different filename) renders correctly with full card content. | Screenshot content differs for what should be the identical view/state | Treat `02-fixed-views.png` as authoritative; `prompts-check.png` was likely a mid-render or scroll-glitch capture, not an intentional "prompts empty state." **Prompts has no defined empty state** (no seed-data-zero case shown or coded) — needs one designed (Ideas' empty state pattern — icon tile + headline + inline capture form — is a reasonable template to reuse).
| 5 | **Star ratings interactivity unclear** — Prompts and Agent cards render `★★★★☆` as a static glyph string (`{{ p.stars }}`), not a component with per-star click handlers. | `Sandbox Brain.dc.html` line 521, 555 — `stars` is a plain string field, no `onClick` per star | Decide whether star ratings are clickable (crowd-rating a prompt) or purely display (single author's rating). If clickable, needs real interaction design (hover preview, half-stars, whose rating is shown vs. aggregate). |
| 6 | **Empty states largely undesigned** outside Ideas and Tasks board columns. No empty state exists in the markup/state for: Notes (list or editor with zero notes), Projects (zero projects), Time (zero entries), Prompts (zero prompts), Agents (zero dev agents/automations — though a "+ Register a new agent" placeholder card exists, implying at-least-one-exists is assumed), Brain (zero canon entries), Home (zero feed items — only per-filter empty language exists, e.g. "Nothing" text is not actually coded for the feed itself). | Grep for `Empty`/`empty` across `Sandbox Brain.dc.html` finds it only in Tasks (`col.empty`) and note backlinks (`noBacklinks`) | Design one consistent empty-state pattern (icon tile + Newsreader headline + muted body copy + primary CTA, per the Ideas empty state) and apply it to every list/collection view before build. |
| 7 | **No responsive/mobile design at all.** Every layout uses fixed pixel widths (sidebar 224px, rails 250–300px, drawer 396px) with no media queries, no flex-wrap fallback, no breakpoints. The `$preview` canvas is locked to 1180×720 (main) / 1180×760 (Ideas). | Full-text search of both `.dc.html` files for `@media` returns zero matches | This is a desktop-only mock. If V2 needs to support tablet/mobile, that layout work has not started and needs a separate design pass — do not assume the fixed-width rails degrade gracefully. |
| 8 | **No error states anywhere** — no failed-save, no network-error, no validation-error styling coded for any form (Ideas quick-capture, ticket creation, note editing, source URL field, etc.). The only "disabled" affordance is button dimming when a required field is empty (e.g. grey "Capture idea →" until title is typed). | No `error`/`fail`/`invalid` tokens found in either file | Needs explicit error-state design: inline field validation, toast/banner for failed saves, offline/conflict-save handling (relevant given the claim-lock and real-time-viewer patterns imply multi-user concurrent edits are expected). |
| 9 | **Growth/Marketing tab is an intentional stub** — explicitly labeled "DRAFT" in-app with placeholder funnel metrics at `opacity:.55` and copy stating it's "a shell for the growth workstream" awaiting the growth lead's input. | `Sandbox Brain.dc.html` lines 651-670, explicit DRAFT badge + explanatory paragraph | Not a gap to silently fill — surface to the team that Growth needs its own requirements/design pass; do not build real functionality against this mock without a follow-up design cycle. |
| 10 | **"Academy" page** referenced in the task brief is **not present anywhere** in any of the 3 `.dc.html` files or 30 screenshots — no nav item, no view flag, no mention in Directions either. | Full-text search for "Academy" across all files: zero matches | Confirm with the team whether Academy was descoped, renamed, or simply not yet designed — do not infer a design for it from adjacent screens; flag as fully unspecified. |
| 11 | **Priority dot colors on task cards are correct and complete** (not actually ambiguous) — confirmed via `PRIO` getter: high=`#b0442e` red, med=`#e0a53f` amber, low=`#a8a29e` grey. Listed here only because the visible markup alone (without reading the JS) doesn't show these values — noting for implementers who skim CSS only. | `Sandbox Brain.dc.html` line 862-864 | No action needed — values are documented in §4 above; this entry exists to prevent someone re-deriving them from screenshots and guessing wrong. |
| 12 | **Ticket ID prefix scheme is implicit, not a documented rule** — RMP/SQ/WH map to project names via hand-authored seed data, not a coded slugify function. No logic exists for auto-generating a new prefix when a 4th project is created. | `tickets` seed array; no `prefix` field or derivation function in either file | Before build, define an explicit rule (e.g. first letters of significant words, or a user-editable per-project prefix field) — currently this only works because someone manually chose good prefixes. |
| 13 | **Idea "Pass" verdict is visually styled as a rejection** (red `#b0442e`/`#c2410c`) but the copy never says "rejected" — it's paired with an `archived` lifecycle status in the one seed example (Campus). Whether Pass verdict should auto-archive, or is independent of lifecycle stage, isn't encoded as a rule. | `verdictMeta()` and the `archived` STAGES entry are separate state fields with no cross-linking logic in `setVerdict()`/`toggleArchive()` | Decide and document: does setting verdict to "Pass" auto-archive the idea, or must a user manually archive separately? Current code treats them as fully independent toggles. |

---

