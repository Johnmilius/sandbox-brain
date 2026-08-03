# Sandbox Brain MCP App — PRODUCT.md

**Register:** product (a dashboard that serves a task — glanceable team status inside a chat).

## What it is
A Skybridge MCP App widget. When a teammate asks Claude "how's our week?" the `brain_dashboard` tool renders an inline card: team hours this week, hours per person, hours per project (stacked bars), and any running timers. Data comes from the same Supabase backend as the website, Mac app, and iOS app. Demo mode (`BRAIN_DASHBOARD_DEMO=1`) supplies synthetic-but-realistic data with no credentials.

## Who / where
Luke + John (two-person Sandbox team, may grow Fall 2026). Rendered inside Claude Desktop chat, claude.ai, and Cowork (all render MCP Apps); Claude Code surfaces show the text fallback. Glanced at mid-conversation, not studied — must read in ~2 seconds and never require scrolling to get the headline.

## Design language (committed brand — do not reinvent)
V2 "editorial workspace", shared with moffatluke.com's Sandbox site and the native apps. Light-only by design.
- **Type:** Newsreader (serif) for display headings; Geist (sans) for body/data; Geist Mono for eyebrow/section labels. Serif + mono contrast is the identity.
- **Color:** near-white surfaces, hairline borders (#ededeb), ink ramp (#1c1c1f → #a8a29e), one accent (#5b3fd6 violet), timer green (#22c55e). Restrained: accent + per-person identity colors for data only, never decoration.
- **Shape:** 13px-radius cards, hairline borders, generous internal padding.

## Bar for "amazing"
Earned familiarity, not novelty: a teammate fluent in Linear/Notion/Stripe should trust it instantly. Elevate via hierarchy, refined data viz, and state-conveying motion (timer pulse, bar draw-in) — not decoration. It must feel like a designed artifact of the same product family, denser and more alive than the current flat version, while staying glance-readable.
