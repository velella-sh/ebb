#!/usr/bin/env node
import { McpServer } from "./server.js";
import { listenStdio } from "./transport.js";

export * from "./types.js";
export { McpServer } from "./server.js";
export { listenStdio } from "./transport.js";
export { checkTool, extractPurlAndVersion } from "./tools/check.js";

// Run stdio server when executed directly as entrypoint
const isDirectExecution =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith("/packages/mcp/dist/src/index.js")) ||
  (process.argv[1] && process.argv[1].endsWith("/ebb-mcp"));

if (isDirectExecution) {
  const server = new McpServer();
  listenStdio(server, { exitOnClose: true });
}
