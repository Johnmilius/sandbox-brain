# V2 Open Items — Design/Dev Follow-ups

Things surfaced while restyling (Task 4 onward) that are conceptual gaps, not
styling gaps — they need a decision or a requirements pass before they can be
built, not just skinned. Fold into the Task 10 review packet.

## Automations (Agents page → Automations tab)

- No way to create a new automation. The tab currently renders a designed
  empty state only — there's no automations table, no creation flow, no
  scheduler/runner.
- This needs a conceptual pass before it becomes an engineering ticket:
  - What IS an automation here — a saved prompt + agent + trigger? Trigger
    type: cron schedule, webhook, manual "run now" button?
  - What does "running" one actually do — call an LLM, post somewhere, write
    to the brain (a note, a knowledge item)?
  - Where does output land, and who sees it ran (a log? a toast? nothing)?
  - Status model per spec (Active / Warning / Paused) — what causes Warning?
- Recommend a short requirements conversation before scoping a migration or
  backend for this, same pattern as Growth waiting on the growth lead.

## Agents — star ratings

- The design shows a 1–5 star rating per agent card. `agents` has no
  `rating` column (`prompts` does). Cards currently omit ratings rather than
  fake them.
- Decide: add `rating` to a future migration (0007 or later), or drop star
  ratings from the agent card design permanently.

## Agents — "used on N tickets" footer stat

- Spec's card footer stat is "used on N tickets", which depends on the Tasks
  feature (migration 0007 / Task 8–9, not built yet as of Task 4).
- Substituted "used in N prompts" (real data via the existing agent→prompt
  `links` table) as a stand-in so the footer isn't fake.
- Once Tasks ships, decide: switch to ticket usage, keep prompt usage, or
  show both.
