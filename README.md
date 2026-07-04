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

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in the Supabase URL, anon key, and `ALLOWED_EMAILS` (the 3 Gmail addresses, comma-separated). Only those accounts can get in.

### 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should be redirected to the login page; sign in with an allowlisted Google account.

### 5. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) (free Hobby plan).
3. Add the same three environment variables in the Vercel project settings.
4. In Supabase **Authentication → URL Configuration**, set the **Site URL** to the Vercel production URL and add it to the redirect allowlist.

Everyone then uses the production URL — it's always on, shared, and live.

## Free-tier notes

- **Supabase pauses free projects after ~1 week of inactivity.** Regular use avoids this; if paused, restore it from the dashboard in one click.
- Storage cap is 1 GB — prefer GitHub URLs for project archives; use zip uploads sparingly.

## Roadmap

- [x] **Phase 0** — live shell: auth, allowlist, dashboard, deploy
- [ ] **Phase 1** — database schema + Row Level Security
- [ ] **Phase 2** — projects + time tracking (timer + manual entry)
- [ ] **Phase 3** — prompt database (tags, search, insights)
- [ ] **Phase 4** — notes + `[[wiki-links]]` + interactive graph
- [ ] **Phase 5** — the Brain: code snippets, decisions, docs, contacts, project archives
- [ ] **Phase 6** — AI-ready polish (search coverage, read API for a future AI agent)

## Project conventions

- Supabase access goes through `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server) — never instantiate clients directly.
- The email allowlist lives in `src/lib/allowlist.ts` and is enforced in middleware and the OAuth callback; Phase 1 adds database-level enforcement via RLS.
