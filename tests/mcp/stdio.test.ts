import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const serverPath = resolve(process.cwd(), "packages/mcp/dist/src/index.js");

describe("MCP Server Process (stdio)", () => {
  it("starts and communicates over stdio with json-rpc 2.0 handshake and tool call", async () => {
    const child = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    // biome-ignore lint/suspicious/noExplicitAny: test responses inspection
    const responses: any[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          try {
            responses.push(JSON.parse(line));
          } catch {
            // ignore non-json
          }
        }
      }
    });

    // biome-ignore lint/suspicious/noExplicitAny: generic response promise
    function waitForResponse(id: string | number): Promise<any> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timed out waiting for response id ${id}. Current responses: ${JSON.stringify(responses)}`));
        }, 5000);

        const poll = () => {
          // biome-ignore lint/suspicious/noExplicitAny: response matching
          const found = responses.find((r: any) => r.id === id);
          if (found) {
            clearTimeout(timer);
            resolve(found);
          } else {
            setTimeout(poll, 10);
          }
        };
        poll();
      });
    }

    const send = (msg: Record<string, unknown>) => {
      child.stdin.write(`${JSON.stringify(msg)}\n`);
    };

    // 1. Initialize
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "root-test", version: "1.0.0" },
      },
    });

    const initResp = await waitForResponse(1);
    assert.equal(initResp.id, 1);
    assert.equal(initResp.result.protocolVersion, "2024-11-05");
    assert.equal(initResp.result.serverInfo.name, "@velella/ebb-mcp");

    // 2. Initialized notification (must produce no response)
    send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(responses.length, 1);

    // 3. Ping
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "ping",
    });
    const pingResp = await waitForResponse(2);
    assert.equal(pingResp.id, 2);
    assert.deepEqual(pingResp.result, {});

    // 4. tools/list includes check tool
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    });
    const listResp = await waitForResponse(3);
    assert.equal(listResp.id, 3);
    assert.ok(listResp.result.tools.some((t: { name: string }) => t.name === "check"));

    // 5. tools/call check tool
    send({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "check",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
        },
      },
    });
    const callResp = await waitForResponse(4);
    assert.equal(callResp.id, 4);
    assert.equal(callResp.result.isError, false);
    const content = JSON.parse(callResp.result.content[0].text);
    assert.equal(content.status, "deprecated");

    // 6. tools/call check_all tool
    send({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          purls: ["pkg:npm/request@2.88.2", "pkg:npm/left-pad@1.3.0"],
        },
      },
    });
    const checkAllResp = await waitForResponse(5);
    assert.equal(checkAllResp.id, 5);
    assert.equal(checkAllResp.result.isError, false);
    const batchContent = JSON.parse(checkAllResp.result.content[0].text);
    assert.equal(batchContent.summary.total, 2);
    assert.equal(batchContent.summary.byStatus.deprecated, 2);

    // Clean up cleanly
    child.stdin.end();
    await new Promise<void>((resolve) => {
      child.on("exit", () => resolve());
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 500);
    });
  });
});
