# AI readiness — how a future AI layer plugs in

The schema was designed so an AI agent (or semantic search) can be added
**without reshaping any data**. This doc is the map for whoever builds it.

## Reading the data today

Everything is exposed through Supabase's auto-generated REST API
(`https://<project-ref>.supabase.co/rest/v1/`) guarded by Row Level Security:
a request must carry a JWT for a user whose email is in `allowed_emails`.
An AI agent gets access one of two ways:

1. **Act as a team member** — sign in a dedicated bot account, add its email
   to `allowed_emails` (and `ALLOWED_EMAILS`). Cleanest for read/write agents.
2. **Service role key** — bypasses RLS entirely; server-side only, never
   shipped to a browser. Fine for a read-only analysis job.

## What to read

| Table | What it holds | Search column |
|---|---|---|
| `projects` | companies/projects | `search_document` |
| `time_entries` | who worked on what, when, how long | — |
| `prompts` | every AI prompt + result notes + 1–5 rating | `search_document` |
| `notes` | markdown wiki (bodies contain `[[wiki-links]]`) | `search_document` |
| `knowledge_items` | code / decisions / docs / contacts / archives (`kind` column; `data` jsonb holds kind-specific fields like `language`, `outcome`, `contact_info`) | `search_document` |
| `links` | graph edges `(source_type, source_id) -> (target_type, target_id)` | — |
| `tags` + `taggables` | shared tag facets across all entity types | — |

`search_document` is a stored `tsvector` (English) — query it with PostgREST's
`?search_document=wfts.<query>` or the JS client's `.textSearch()`.

Useful analysis targets, in the spirit of "what are we doing right/wrong":

- `prompts.rating` by `ai_tool` — which tools/prompt styles work for us
- `knowledge_items` with `kind = 'decision'` and `data->>'outcome'` — the
  tried/worked/failed history
- `time_entries` joined to `projects` — where effort actually goes

## Adding semantic search later (the planned upgrade path)

1. `create extension if not exists vector;` (pgvector ships with Supabase, free tier included)
2. Add `embedding vector(1536)` (or your model's dim) to `prompts`, `notes`,
   `knowledge_items`, `projects` — nullable, so it's fully additive.
3. Backfill: embed `title + body/content` per row via your embedding API,
   then keep fresh with a database webhook or on-write embed in the server actions.
4. Query with an RPC like `match_documents(query_embedding, match_count)`
   using cosine distance (`<=>`), unioned across the four tables.
5. Optional chat layer: a Next.js route handler that embeds the question,
   pulls top-k rows, and hands them to Claude with the question. Keep API keys
   server-side in env vars.

Nothing above requires touching existing columns, pages, or RLS policies.
