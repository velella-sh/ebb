import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";
import { McpServer, listenStdio } from "../src/index.js";
import type { JsonRpcResponse } from "../src/types.js";

function setupStdioSession() {
  const server = new McpServer();
  const clientInput = new PassThrough(); // server stdin
  const serverOutput = new PassThrough(); // server stdout

  const responses: JsonRpcResponse[] = [];
  let buffer = "";

  serverOutput.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        responses.push(JSON.parse(line));
      }
    }
  });

  const close = listenStdio(server, { input: clientInput, output: serverOutput });

  async function send(message: Record<string, unknown>): Promise<void> {
    clientInput.write(`${JSON.stringify(message)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return {
    server,
    send,
    responses,
    close,
  };
}

describe("MCP Stdio Transport", () => {
  it("initializes cleanly with protocolVersion 2024-11-05", async () => {
    const session = setupStdioSession();

    await session.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    assert.equal(session.responses.length, 1);
    const resp = session.responses[0];
    assert.ok(resp);
    assert.equal(resp.id, 1);
    assert.equal(resp.jsonrpc, "2.0");

    const result = resp.result as {
      protocolVersion: string;
      serverInfo: { name: string; version: string };
      capabilities: Record<string, unknown>;
    };
    assert.equal(result.protocolVersion, "2024-11-05");
    assert.equal(result.serverInfo.name, "@velella/ebb-mcp");
    assert.ok(result.capabilities.tools);
    assert.ok(result.capabilities.resources);

    session.close();
  });

  it("handles notifications/initialized without sending a response", async () => {
    const session = setupStdioSession();

    await session.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    assert.equal(session.responses.length, 0);
    assert.equal(session.server.isInitialized(), true);

    session.close();
  });

  it("responds to ping", async () => {
    const session = setupStdioSession();

    await session.send({
      jsonrpc: "2.0",
      id: 42,
      method: "ping",
    });

    assert.equal(session.responses.length, 1);
    const resp = session.responses[0];
    assert.ok(resp);
    assert.equal(resp.id, 42);
    assert.deepEqual(resp.result, {});

    session.close();
  });

  it("returns empty tools list before tools are added", async () => {
    const session = setupStdioSession();

    await session.send({
      jsonrpc: "2.0",
      id: "req-tools",
      method: "tools/list",
    });

    assert.equal(session.responses.length, 1);
    const resp = session.responses[0];
    assert.ok(resp);
    assert.equal(resp.id, "req-tools");
    assert.deepEqual(resp.result, { tools: [] });

    session.close();
  });

  it("returns JSON-RPC parse error on malformed input", async () => {
    const server = new McpServer();
    const input = new PassThrough();
    const output = new PassThrough();
    const responses: JsonRpcResponse[] = [];
    output.on("data", (chunk: Buffer) => {
      responses.push(JSON.parse(chunk.toString("utf8").trim()));
    });
    const close = listenStdio(server, { input, output });

    input.write("THIS_IS_NOT_VALID_JSON\n");
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(responses.length, 1);
    const resp = responses[0];
    assert.ok(resp);
    assert.equal(resp.error?.code, -32700);

    close();
  });

  it("returns -32600 on invalid request without jsonrpc 2.0", async () => {
    const session = setupStdioSession();

    await session.send({
      id: 99,
      method: "ping",
    });

    assert.equal(session.responses.length, 1);
    const resp = session.responses[0];
    assert.ok(resp);
    assert.equal(resp.error?.code, -32600);

    session.close();
  });
});
