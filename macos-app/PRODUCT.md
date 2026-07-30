# Sandbox Brain — native apps (macOS + iOS)

**Register:** product. These are tools people work inside; design serves the task.

## What it is
Native SwiftUI clients for the Sandbox Brain team hub — the same Supabase backend as the website. Thirteen sections: Home digest, Projects, Ideas, Tasks (kanban), Time tracking, Prompts, Agents, Notes with `[[wiki-links]]`, Brain knowledge base, entity Graph, Academy, Growth, Search. `Sources/SandboxBrainKit/` is the shared core (models, backend, auth, theme, app state); `Sources/SandboxBrain/` is the Mac app; `ios/` is the iPhone/iPad app.

## Who / where
Luke and John (two-person Sandbox team, growing Fall 2026). The Mac app is a second-monitor companion open all day next to an editor — glanced at between tasks, not studied. The iOS app is checked standing up, one-handed, for a few seconds. Both are authenticated tools for people who already know the data.

## Design language (committed — preserve, don't reinvent)
V2 "editorial workspace", shared with the website so the three clients read as one product.
- **Type:** system serif for display (page titles, figures), system sans for body/data, monospaced for labels and timestamps. The serif/mono contrast is the identity.
- **Color:** `Brand` tokens in `Theme.swift`, light and dark variants via `dynamic()`. Restrained: near-neutral surfaces, hairline borders, one violet accent (`Brand.purple`) plus per-person identity colors for data, and green only for live/running state. Color is never decoration.
- **Material:** macOS 26 Liquid Glass (`GlassCard`) for primary containers, flat surfaces (`FlatCard`) for dense repeated rows so glass shadows don't stack. Glass must be **tinted** — untinted glass transmits the user's desktop wallpaper and reads as stray gradients.
- **Mono labels** (`MonoLabel`) are the brand's section voice, matching the site. They're deliberate here, not scaffolding — but consolidate cards rather than multiplying labels.

## Layout rules
- Dashboards fill the window; the page doesn't scroll, the long list inside it does.
- Spacing has rhythm: tight within a group (6–10pt), generous between sections (24–28pt). Never one uniform gap everywhere.
- Size-class branches are wrong for width decisions — iPad portrait is "regular" but narrow. Use `ViewThatFits` or actual available width (this caused a real clipping bug).
- Timer publishers are always `@State`; a `let` publisher dies when the parent re-renders.

## Bar for quality
Earned familiarity — someone fluent in Linear, Things, or Fantastical should trust it on sight. Hierarchy and space do the work; no hero-metric tiles, no identical card grids, no decorative motion. Motion conveys state only (a running timer ticking, a bar drawing in).
