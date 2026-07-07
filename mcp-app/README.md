# Sandbox Brain MCP App (Skybridge)

An [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) widget for the hub, built with [Skybridge](https://github.com/alpic-ai/skybridge). Ask Claude "how's our week?" and get a rendered dashboard — team hours, hours per person, per-project bars, running timers — inside the chat.

Implements [#2](https://github.com/Johnmilius/sandbox-brain/issues/2).

## Requirements

- Node 24+
- The repo root `.env.local` filled in (same file the `mcp/` server uses): `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`.

## Develop

```bash
cd mcp-app
npm install
npm run dev          # http://localhost:3000/ = DevTools, /mcp = server
npm run dev:tunnel   # public URL to test inside real Claude/ChatGPT
```

## Test

```bash
npm test
```

Covers the aggregation logic (`summary.ts`) and the tool handler with a mocked Supabase client. The view is verified manually in the DevTools emulator.

## Layout

- `src/server.ts` — MCP server, registers `brain_dashboard` (bound to the `dashboard` view)
- `src/dashboard-tool.ts` — handler: Supabase query → summary
- `src/summary.ts` — pure aggregation (fully unit-tested)
- `src/views/dashboard.tsx` — the React widget
