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

2. Add two lines to the repo's `.env.local` (create it from `.env.example` if
   needed — it's gitignored):

   ```
   SUPABASE_SERVICE_ROLE_KEY=<from Supabase -> Settings -> API>
   BRAIN_ACTOR_EMAIL=<your own gmail>
   ```

   `BRAIN_ACTOR_EMAIL` is who your actions are attributed to — timers and
   prompts you create via Claude show up as **you** in the app. You must have
   signed into the web app at least once with that account.

   ⚠️ The service role key bypasses row-level security. Keep it in the
   gitignored `.env.local` on your own machine only — never commit it, never
   put it in the Next.js `NEXT_PUBLIC_*` vars, never deploy it to a client.

3. Connect a client:

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

The server talks straight to Supabase with the service role key and stamps
every write with the profile matching `BRAIN_ACTOR_EMAIL`. Database-level
allowlisting still protects the web app; this key is the "admin backdoor"
that makes local AI tooling simple — which is why it must stay local.

## Development

```bash
npm run dev     # run from TypeScript with tsx
npm run build   # compile to dist/
```

Tag and wiki-link logic mirrors the web app (`src/lib/tags.ts`,
`src/lib/wiki-links.ts`) — keep them in sync if either side changes.
