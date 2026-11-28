import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("./run-stdio-server.js", import.meta.url));

describe("MCP Server End-to-End (real stdio pipes)", () => {
  it("executes complete lifecycle: handshake, tools/list, calling every tool, and resource reads", async () => {
    const child = spawn(process.execPath, [serverPath], {
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
    assert.equal(initResp.result.serverInfo.name, "@velella/ebb");
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

    // 4. tools/list: all 8 tools registered
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    });
    const listResp = await waitForResponse(3);
    assert.equal(listResp.id, 3);
    const toolNames = listResp.result.tools.map((t: { name: string }) => t.name);
    assert.equal(toolNames.length, 9);
    assert.ok(toolNames.includes("check"));
    assert.ok(toolNames.includes("check_all"));
    assert.ok(toolNames.includes("check_install"));
    assert.ok(toolNames.includes("diff"));
    assert.ok(toolNames.includes("pick_version"));
    assert.ok(toolNames.includes("replacement_for"));
    assert.ok(toolNames.includes("runtime_support"));
    assert.ok(toolNames.includes("sources_of"));
    assert.ok(toolNames.includes("upcoming"));

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
    assert.ok(checkResp.result.structuredContent);

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
    assert.ok(checkAllResp.result.structuredContent);

    // 7. tools/call check_install
    send({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "check_install",
        arguments: {
          command: "npm install request@2.88.2 express@4.18.2",
        },
      },
    });
    const checkInstallResp = await waitForResponse(6);
    assert.equal(checkInstallResp.id, 6);
    assert.equal(checkInstallResp.result.isError, false);
    const checkInstallResult = JSON.parse(checkInstallResp.result.content[0].text);
    assert.equal(checkInstallResult.packages.length, 2);
    assert.ok(checkInstallResp.result.structuredContent);

    // 8. tools/call diff
    send({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "diff",
        arguments: {
          from: "bundled",
          to: "active",
          format: "json",
        },
      },
    });
    const diffResp = await waitForResponse(7);
    assert.equal(diffResp.id, 7);
    assert.equal(diffResp.result.isError, false);
    assert.ok(diffResp.result.structuredContent);

    // 9. tools/call pick_version
    send({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "pick_version",
        arguments: {
          purl: "node",
          as_of: "2026-11-15",
        },
      },
    });
    const pickResp = await waitForResponse(8);
    assert.equal(pickResp.id, 8);
    assert.equal(pickResp.result.isError, false);
    const pickResult = JSON.parse(pickResp.result.content[0].text);
    assert.ok(pickResult.lines.length > 0);
    assert.ok(pickResp.result.structuredContent);

    // 10. tools/call replacement_for
    send({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "replacement_for",
        arguments: {
          purl: "pkg:npm/request@2.88.2",
        },
      },
    });
    const repResp = await waitForResponse(9);
    assert.equal(repResp.id, 9);
    assert.equal(repResp.result.isError, false);
    const repResult = JSON.parse(repResp.result.content[0].text);
    assert.ok(repResult.replacement);
    assert.ok(repResp.result.structuredContent);

    // 11. tools/call sources_of
    send({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "sources_of",
        arguments: {
          ruleId: "npm.package.request.deprecated",
        },
      },
    });
    const sourcesResp = await waitForResponse(10);
    assert.equal(sourcesResp.id, 10);
    assert.equal(sourcesResp.result.isError, false);
    const sourcesResult = JSON.parse(sourcesResp.result.content[0].text);
    assert.equal(sourcesResult.ruleId, "npm.package.request.deprecated");
    assert.ok(sourcesResp.result.structuredContent);

    // 12. tools/call upcoming
    send({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "upcoming",
        arguments: {
          as_of: "2026-01-01",
        },
      },
    });
    const upcomingResp = await waitForResponse(11);
    assert.equal(upcomingResp.id, 11);
    assert.equal(upcomingResp.result.isError, false);
    const upcomingResult = JSON.parse(upcomingResp.result.content[0].text);
    assert.ok(upcomingResult.count > 0);
    assert.ok(upcomingResp.result.structuredContent);

    // 13. resources/list
    send({
      jsonrpc: "2.0",
      id: 12,
      method: "resources/list",
    });
    const resListResp = await waitForResponse(12);
    assert.equal(resListResp.id, 12);
    assert.ok(resListResp.result.resources.some((r: { uri: string }) => r.uri === "ebb://upcoming"));

    // 14. resources/read
    send({
      jsonrpc: "2.0",
      id: 13,
      method: "resources/read",
      params: {
        uri: "ebb://upcoming",
      },
    });
    const resReadResp = await waitForResponse(13);
    assert.equal(resReadResp.id, 13);
    const upcomingData = JSON.parse(resReadResp.result.contents[0].text);
    assert.ok(upcomingData.count > 0);

    // 15. Clean exit on EOF
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
