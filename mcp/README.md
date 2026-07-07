# Sandbox Brain MCP server

Lets Claude (Desktop, Code, or any MCP client) drive the team hub from chat:

> "start a timer on Acme" · "log 2 hours on the pitch deck yesterday" ·
> "save this prompt, rated 5, tag it landing-page" · "append these takeaways
> to the Standup note" · "what did we decide about auth?" · "how much did we
> work this week?"

## Tools (15)

| Area | Tools |
|---|---|
| Projects | `brain_list_projects`, `brain_create_project` |
| Time | `brain_start_timer`, `brain_stop_timer`, `brain_log_time`, `brain_time_summary` |
| Prompts | `brain_save_prompt`, `brain_search_prompts` |
| Notes | `brain_create_note`, `brain_append_to_note`, `brain_get_note`, `brain_list_notes` |
| Brain | `brain_add_knowledge`, `brain_search_knowledge` |
| Search | `brain_search` (everything at once) |

**No delete tools, by design.** Destructive actions stay in the web UI.

## Setup (each teammate, once)

1. Clone the repo, then:

   ```bash
   cd mcp && npm install   # also builds dist/ automatically
   ```

2. Get your personal token: sign into the web app, open **Profile → MCP
   access**, and click **Reveal my MCP token**.

3. Add it to the repo's `.env.local` (create it from `.env.example` if needed —
   it's gitignored). You also need the anon key and URL, which the web app
   already uses:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<from Supabase -> Settings -> API>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase -> Settings -> API>
   BRAIN_USER_REFRESH_TOKEN=<from Profile -> MCP access>
   ```

   Everything you do via Claude is attributed to **you** and runs as your own
   account, so all the app's row-level-security rules still apply — the token
   can only do what you can do in the web app, and it's revocable for just you
   (sign out everywhere / rotate) without affecting teammates.

   ⚠️ Treat the token like a password. Keep it in the gitignored `.env.local`
   on your own machine only — never commit it, never deploy it. The server
   keeps the rotated token written back to `.env.local` so restarts keep
   working; the first time it runs, your browser may ask you to sign in again
   (the session moved to the server) — just sign back in.

   > **Legacy service-role mode.** Older setups that use
   > `SUPABASE_SERVICE_ROLE_KEY` + `BRAIN_ACTOR_EMAIL` still work, but that key
   > bypasses row-level security and isn't individually revocable — prefer the
   > per-user token above. If `BRAIN_USER_REFRESH_TOKEN` is set, the key is
   > ignored.

4. Connect a client:

   **Claude Code** — nothing to do; the repo's `.mcp.json` registers the
   server automatically when you work inside this folder.

   **Claude Desktop** — add to `claude_desktop_config.json`
   (Settings → Developer → Edit Config):

   ```json
   {
     "mcpServers": {
       "sandbox-brain": {
         "command": "node",
         "args": ["C:\\path\\to\\Sandbox-brain-tracker\\mcp\\dist\\index.js"]
       }
     }
   }
   ```

   Env vars are read from the repo's `.env.local` automatically; you can also
   set them explicitly in the config's `env` block instead.

## How it authenticates

**Per-user mode (default when `BRAIN_USER_REFRESH_TOKEN` is set).** On startup
the server signs in with your refresh token using the public anon key, so every
query runs as `authenticated` — the same row-level-security policies that guard
the web app guard the MCP server too. Attribution comes from the session
(`auth.uid()`), and the rotated refresh token is written back to `.env.local` so
restarts keep working. A leaked laptop exposes one revocable user session, not a
skeleton key.

**Legacy service-role mode (fallback).** If no refresh token is present, the
server talks to Supabase with `SUPABASE_SERVICE_ROLE_KEY` and stamps each write
with the profile matching `BRAIN_ACTOR_EMAIL`. That key bypasses RLS entirely,
so it must stay on local machines only — never commit or deploy it. Prefer
per-user mode.

## Development

```bash
npm run dev     # run from TypeScript with tsx
npm run build   # compile to dist/
```

Tag and wiki-link logic mirrors the web app (`src/lib/tags.ts`,
`src/lib/wiki-links.ts`) — keep them in sync if either side changes.
