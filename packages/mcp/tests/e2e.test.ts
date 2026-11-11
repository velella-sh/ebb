import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("../src/index.js", import.meta.url));

describe("MCP Server End-to-End (real stdio pipes)", () => {
  it("executes complete lifecycle: handshake, tools/list, tool invocations, and resource reads", async () => {
    const child = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    // biome-ignore lint/suspicious/noExplicitAny: response array for test assertions
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
            // non-json lines ignored
          }
        }
      }
    });

    // biome-ignore lint/suspicious/noExplicitAny: response promise helper
    function waitForResponse(id: string | number): Promise<any> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timed out waiting for response id ${id}. Responses: ${JSON.stringify(responses)}`));
        }, 5000);

        const poll = () => {
          // biome-ignore lint/suspicious/noExplicitAny: response inspection
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

    // 1. Client handshake (initialize)
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "e2e-client", version: "1.0.0" },
      },
    });

    const initResp = await waitForResponse(1);
    assert.equal(initResp.id, 1);
    assert.equal(initResp.result.protocolVersion, "2024-11-05");
    assert.equal(initResp.result.serverInfo.name, "@velella/ebb-mcp");
    assert.ok(initResp.result.capabilities.tools);
    assert.ok(initResp.result.capabilities.resources);

    // 2. notifications/initialized (no response expected)
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

    // 4. tools/list
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    });
    const listResp = await waitForResponse(3);
    assert.equal(listResp.id, 3);
    const toolNames = listResp.result.tools.map((t: { name: string }) => t.name);
    assert.ok(toolNames.includes("check"));
    assert.ok(toolNames.includes("check_all"));
    assert.ok(toolNames.includes("replacement_for"));

    // 5. tools/call check
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
    const checkResp = await waitForResponse(4);
    assert.equal(checkResp.id, 4);
    assert.equal(checkResp.result.isError, false);
    const checkResult = JSON.parse(checkResp.result.content[0].text);
    assert.equal(checkResult.status, "deprecated");
    assert.ok(checkResult.provenance.sources.length > 0);
    assert.ok(checkResult.provenance.reviewers.length > 0);

    // 6. tools/call check_all
    send({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "check_all",
        arguments: {
          items: ["pkg:npm/request@2.88.2", { purl: "pkg:npm/left-pad", version: "1.3.0" }],
        },
      },
    });
    const checkAllResp = await waitForResponse(5);
    assert.equal(checkAllResp.id, 5);
    assert.equal(checkAllResp.result.isError, false);
    const checkAllResult = JSON.parse(checkAllResp.result.content[0].text);
    assert.equal(checkAllResult.summary.total, 2);
    assert.equal(checkAllResult.results.length, 2);

    // 7. tools/call replacement_for
    send({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "replacement_for",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
        },
      },
    });
    const repResp = await waitForResponse(6);
    assert.equal(repResp.id, 6);
    assert.equal(repResp.result.isError, false);
    const repResult = JSON.parse(repResp.result.content[0].text);
    assert.ok(repResult.replacement);

    // 8. resources/list
    send({
      jsonrpc: "2.0",
      id: 7,
      method: "resources/list",
    });
    const resListResp = await waitForResponse(7);
    assert.equal(resListResp.id, 7);
    assert.ok(resListResp.result.resources.some((r: { uri: string }) => r.uri === "ebb://upcoming"));

    // 9. resources/read
    send({
      jsonrpc: "2.0",
      id: 8,
      method: "resources/read",
      params: {
        uri: "ebb://upcoming",
      },
    });
    const resReadResp = await waitForResponse(8);
    assert.equal(resReadResp.id, 8);
    const upcomingData = JSON.parse(resReadResp.result.contents[0].text);
    assert.ok(upcomingData.count > 0);

    // 10. Clean exit on EOF
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
