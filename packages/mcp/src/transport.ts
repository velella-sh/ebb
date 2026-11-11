import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { McpServer } from "./server.js";

export interface StdioTransportOptions {
  input?: Readable | undefined;
  output?: Writable | undefined;
  exitOnClose?: boolean | undefined;
}

export function listenStdio(server: McpServer, options?: StdioTransportOptions): () => void {
  const input = options?.input ?? process.stdin;
  const output = options?.output ?? process.stdout;
  const exitOnClose = options?.exitOnClose ?? false;

  const rl = createInterface({
    input,
    terminal: false,
  });

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const parseError = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON" },
      };
      output.write(`${JSON.stringify(parseError)}\n`);
      return;
    }

    const response = await server.handleMessage(parsed);
    if (response !== null) {
      output.write(`${JSON.stringify(response)}\n`);
    }
  });

  rl.on("close", () => {
    if (exitOnClose) {
      process.exit(0);
    }
  });

  return () => {
    rl.close();
  };
}
