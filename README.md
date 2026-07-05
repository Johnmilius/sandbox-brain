# Sandbox Brain

The team's central hub for the Sandbox entrepreneurship program: **time tracking**, a **prompt database**, **linked notes with a graph view**, and a **cross-project knowledge base** ("the Brain") — one live web app all three of us share. No syncing, no laptop-server.

> **V1** — this is a starting point, expected to go through several UI and data-model iterations as we learn what we actually need.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind v4 + [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com) — Postgres, Google auth, storage, Row Level Security (free tier)
- [Vercel](https://vercel.com) — hosting (free tier)

## One-time setup (whoever owns the accounts)

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free tier) and create a project named `sandbox-brain`.
2. From **Settings → API**, copy the **Project URL** and **anon public key**.

### 2. Set up Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com), create a project → **APIs & Services → OAuth consent screen** → External → fill in app name + your email. Add your 3 Gmail addresses as test users (or publish the app).
2. **Credentials → Create credentials → OAuth Client ID → Web application.**
3. In Supabase: **Authentication → Providers → Google** — it shows you the exact **redirect URL** to paste into the Google OAuth client's "Authorized redirect URIs".
4. Paste the Google **Client ID** and **Client Secret** into the Supabase Google provider settings and enable it.

### 3. Apply the database schema

1. Open [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) and **add your two teammates' emails** to the `allowed_emails` seed at the bottom.
2. Easiest: paste each file in [supabase/migrations](supabase/migrations) (0001, then 0002) into the Supabase dashboard **SQL Editor** and run it.
   Or with the CLI: `npm run db:link` (needs the project ref) then `npm run db:push`.
3. After the schema is applied (and whenever it changes), generate TypeScript types: `npm run db:types`.

### 4. Configure environment

```bash
cp .env.example .env.local
```

Fill in the Supabase URL, anon key, and `ALLOWED_EMAILS` (the 3 Gmail addresses, comma-separated). Only those accounts can get in.

### 5. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should be redirected to the login page; sign in with an allowlisted Google account.

### 6. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) (free Hobby plan).
3. Add the same three environment variables in the Vercel project settings.
4. In Supabase **Authentication → URL Configuration**, set the **Site URL** to the Vercel production URL and add it to the redirect allowlist.

Everyone then uses the production URL — it's always on, shared, and live.

## Free-tier notes

- **Supabase pauses free projects after ~1 week of inactivity.** Regular use avoids this; if paused, restore it from the dashboard in one click.
- Storage cap is 1 GB — prefer GitHub URLs for project archives; use zip uploads sparingly.

## What's inside (V1)

- **Projects** — the companies/projects the team works on
- **Time** — live start/stop timer (survives refresh) + manual backfill, 7-day summaries
- **Prompts** — the team prompt database: full text, result notes, tool, 1–5 rating, tags, full-text search
- **Notes** — markdown wiki with `[[wiki-links]]` and backlinks
- **Graph** — Obsidian-style force graph over everything (notes, prompts, projects, brain items, people)
- **Brain** — reusable knowledge: code snippets, decisions/learnings, documents, contacts, project archives (GitHub URL or zip upload)
- **Search** — one box across projects, notes, prompts, and the brain

All phases (0–6) of the V1 build plan are implemented. The AI layer
(semantic search / analysis agent) is deliberately deferred — see
[docs/ai-readiness.md](docs/ai-readiness.md) for the drop-in plan.

## Talk to it from Claude (MCP)

The [mcp/](mcp/README.md) folder has an MCP server so Claude can drive the hub
from chat — start timers, log time, save prompts, append to notes, add
knowledge, and search everything, attributed to whoever's machine it runs on.
Setup takes ~2 minutes per teammate; see [mcp/README.md](mcp/README.md).

## Project conventions

- Supabase access goes through `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server) — never instantiate clients directly.
- The email allowlist lives in `src/lib/allowlist.ts` and is enforced in middleware and the OAuth callback; Phase 1 adds database-level enforcement via RLS.
