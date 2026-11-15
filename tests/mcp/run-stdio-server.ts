import { McpServer, listenStdio } from "../../src/mcp/index.js";

listenStdio(new McpServer(), { exitOnClose: true });
