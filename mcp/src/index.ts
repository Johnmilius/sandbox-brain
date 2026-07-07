#!/usr/bin/env node
/**
 * Sandbox Brain MCP server.
 *
 * Lets Claude (Desktop, Code, or any MCP client) drive the team hub:
 * start/stop timers, log time, save prompts, write notes, grow the
 * knowledge base, and search everything — all attributed to the person
 * configured via BRAIN_ACTOR_EMAIL.
 *
 * Deliberately has NO delete tools; destructive actions stay in the web UI.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { assertConfigured, initAuth, getActor, AUTH_MODE } from "./context.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerTimeTools } from "./tools/time.js";
import { registerPromptTools } from "./tools/prompts.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerSearchTools } from "./tools/search.js";

const server = new McpServer({
  name: "sandbox-brain-mcp-server",
  version: "1.0.0",
});

registerProjectTools(server);
registerTimeTools(server);
registerPromptTools(server);
registerNoteTools(server);
registerKnowledgeTools(server);
registerSearchTools(server);

async function main(): Promise<void> {
  const configError = assertConfigured();
  if (configError) {
    // stdio servers must not write to stdout; stderr is safe.
    console.error(`sandbox-brain-mcp-server: ${configError}`);
    process.exit(1);
  }

  await initAuth();
  const actor = await getActor();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `sandbox-brain-mcp-server running (acting as ${actor.email}, ${AUTH_MODE} auth).`,
  );
}

main().catch((error) => {
  console.error("sandbox-brain-mcp-server failed to start:", error);
  process.exit(1);
});
