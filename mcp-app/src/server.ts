import { McpServer } from "skybridge/server";
import { dashboardHandler } from "./dashboard-tool.js";

const server = new McpServer(
  { name: "sandbox-brain-app", version: "0.0.1" },
  { capabilities: {} },
).registerTool(
  {
    name: "brain_dashboard",
    description:
      "Show the team's weekly time dashboard: total hours, hours per person, hours per project, and any running timers. Call this EXACTLY ONCE when the user asks how the week is going, for a time summary, or for the dashboard. The UI displays everything; do not call other tools to supplement it.",
    inputSchema: {},
    view: {
      component: "dashboard",
      description: "Sandbox Brain weekly dashboard",
    },
  },
  dashboardHandler,
);

server.run();

export type AppType = typeof server;
