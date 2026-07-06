# TODO — Grouped by Task Depth & Model Assignment

## Tier 1 — Quick Fixes ✅ DONE
**Suggested model: Haiku 4.5 (or Sonnet 5, low effort)**
Small, localized bugs with clear expected behavior. No design decisions needed.

**2.** ✅ In the start-a-timer section for the time page, it seems like it renders the project's ID instead of its name value.

**3.** ✅ Same as #2 but in the prompts filtering — it seems to render `__all__` instead of what it's supposed to. Also unclear what those two filtering bars are used for.

**9.** ✅
## Error Type
Runtime Error

## Error Message
Base UI: MenuGroupContext is missing. Menu group parts must be used within `<Menu.Group>` or `<Menu.RadioGroup>`.

```
at DropdownMenuLabel (src/components/ui/dropdown-menu.tsx:64:5)
at AppHeader (src/components/app-header.tsx:95:13)
at BrainPage (src/app/brain/page.tsx:69:7)
```

## Code Frame
```
  62 | }) {
  63 |   return (
> 64 |     <MenuPrimitive.GroupLabel
     |     ^
  65 |       data-slot="dropdown-menu-label"
  66 |       data-inset={inset}
  67 |       className={cn(
```
Next.js version: 16.2.10 (Turbopack)

**10.** ✅ Also, clicking on the personal icon seems to error out the website and break it.

---

## Tier 2 — Standard Feature Work ✅ DONE
**Suggested model: Sonnet 5 (default effort)**
Normal-sized features, touches a handful of files, requirements already clear.

**1.** ✅ For time tracking, have an option to set an end date, and it will auto-calculate the time between the two dates instead of singularly relying on manually knowing how much time you spent.

**5.** ✅ Notes — no need for a multi-step saving process. Open it up, have the title and description in the notes, then save from that initial box. Saves time on entering and exiting.

**8.** ✅ Admin or profile page would be nice to edit profile name, etc. Keep it simple, not overcomplicated. This is mainly so our information in the app is displayed by our actual names instead of email addresses.

**11.** ✅ More metrics to measure in the time tracking page would be nice. Some graphs over time and across people could be cool.

**13.** ✅ Safety around deleting an item — like a "did you want to delete this item" warning.

---

## Tier 3 — Design-Judgment Features ✅ DONE (v1 per docs/TIER3_PLAN.md)
**Suggested model: Opus 4.8** (sketch the data model / approach first, then hand implementation to Sonnet 5)
Real ambiguity in *how* to build it — data model decisions, sync/consistency concerns, or cross-entity matching logic.

> Migrations `0003_prompt_favorites.sql` and `0004_agents.sql` must be applied to Supabase
> (dashboard SQL editor or `npm run db:push`) for #4 and #4b to work at runtime.

**4.** ✅ A way to save highly valuable prompts in the prompt section — like a favorite/star system that syncs and keeps consistent prompts across developers, so instructions to AI agents are consistent and uniform. Also enables fine-tuning agents, etc.

**4b.** ✅ Related to #4 — an agents section (own page or within this page) to save used/active agents.

**7.** ✅ In the graph, filter by certain parameters to see relationships more clearly — e.g., by person ID. Does each note have a person ID attached so we know who recorded it? This is important information we need to track. *(Yes — notes have author_id; the graph now draws authorship edges and filters by person/project/type.)*

**7b.** ✅ Along with the graph — can it programmatically add linking tags to items themselves, so we don't have to manage that ourselves? Should be automated so relationships surface faster. *(Phase A: computed shared-tag "suggested" edges + suggested-tag chips in forms. Persisted auto-links / embeddings deferred.)*

**12.** ✅ Along with the time page — link items to things done during that time frame, attached to the time log. A search function that links dates of notes/prompts, etc., automatically by date range and person ID, so we can see what was done during which session. *(Automatic session activity + person filter; explicit pinning deferred.)*

**15.** ✅ File and folder uploadability for the brain (and potentially elsewhere). E.g., adding an entire project via GitHub repo, file, or folder upload instead of copy/paste. *(Phase 1: multi-file + folder upload with manifest. GitHub-repo import deferred to Phase 2.)*

---

## Tier 4 — Not Coding Tasks Yet

**6.** How does the brain section work? *(Just needs an answer/walkthrough — no coding.)*

**14.** *(Long-term goal, not now)* Dynamic phone view accessibility — just the essentials like logging time, with in-depth usage reserved for desktop.

**16.** Business management tooling for our marketing friend — code/prompt tracking exists for devs, but he may want to track networking, marketing ideas, etc. *(Needs a requirements conversation before becoming an engineering ticket.)*
