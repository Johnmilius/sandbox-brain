import { McpServer } from "skybridge/server";

const server = new McpServer(
  { name: "sandbox-brain-app", version: "0.0.1" },
  { capabilities: {} },
);

server.run();

export type AppType = typeof server;
