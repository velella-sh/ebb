import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  assertWithinBaseline,
  MCP_START_BASELINE_MEDIAN_MS,
  MCP_START_CI_CEILING_MS,
  MCP_START_REGRESSION_THRESHOLD,
} from "../tools/mcp-start-baseline.js";

const binPath = resolve(process.cwd(), "dist/src/bin.js");

async function measureOnce(): Promise<number> {
  const started = process.hrtime.bigint();
  const child = spawn(process.execPath, [binPath, "mcp"], { stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  const ms = await new Promise<number>((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("timeout"));
    }, 15000);
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as { id?: unknown };
          if (msg.id === 1) {
            clearTimeout(timer);
            resolvePromise(Number(process.hrtime.bigint() - started) / 1e6);
          }
        } catch {
          // ignore
        }
      }
    });
    child.on("error", reject);
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      })}\n`,
    );
  });
  child.stdin.end();
  if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
  return ms;
}

describe("MCP cold-start bench", () => {
  it("fails when median regresses more than 20% over baseline", () => {
    const over = MCP_START_BASELINE_MEDIAN_MS * (1 + MCP_START_REGRESSION_THRESHOLD) + 1;
    assert.throws(() => assertWithinBaseline({ medianMs: over }), /MCP cold-start regression/);
    assert.doesNotThrow(() =>
      assertWithinBaseline({
        medianMs: MCP_START_BASELINE_MEDIAN_MS * (1 + MCP_START_REGRESSION_THRESHOLD),
      }),
    );
  });

  it("keeps process start → initialize under the CI ceiling", async () => {
    const once = await measureOnce();
    assert.ok(once > 0);
    assert.ok(
      once < MCP_START_CI_CEILING_MS,
      `MCP cold-start ${once.toFixed(2)}ms exceeds CI ceiling ${MCP_START_CI_CEILING_MS}ms`,
    );
  });
});
