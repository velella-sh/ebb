/**
 * CI path for mcp-setup-7: measure process start → initialize on the current
 * runner and fail when the median regresses more than 20% vs the recorded
 * ubuntu-latest baseline.
 *
 * Invoked from `npm run bench` (used by `.github/workflows/bench.yml`).
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertWithinCiBaseline,
  MCP_START_CI_BASELINE_MEDIAN_MS,
  MCP_START_REGRESSION_THRESHOLD,
  regressionLimitMs,
} from "./mcp-start-baseline.js";

const binPath = resolve(process.cwd(), "dist/src/bin.js");

async function measureOnce(): Promise<number> {
  const started = process.hrtime.bigint();
  const child = spawn(process.execPath, [binPath, "mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  const elapsedMs = await new Promise<number>((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timed out waiting for MCP initialize during CI cold-start check"));
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
          // ignore non-json
        }
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.stdin?.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-start-ci-check", version: "1.0.0" },
        },
      })}\n`,
    );
  });

  child.stdin?.end();
  if (child.exitCode === null && !child.killed) {
    child.kill("SIGKILL");
  }
  return elapsedMs;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export async function runMcpStartCiCheck(iterations = 5): Promise<{ medianMs: number }> {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    samples.push(await measureOnce());
  }
  const stats = { medianMs: median(samples) };
  const limit = regressionLimitMs(MCP_START_CI_BASELINE_MEDIAN_MS, MCP_START_REGRESSION_THRESHOLD);
  process.stdout.write(
    `MCP cold-start CI check: median ${stats.medianMs.toFixed(2)}ms (baseline ${MCP_START_CI_BASELINE_MEDIAN_MS}ms, +${MCP_START_REGRESSION_THRESHOLD * 100}% limit ${limit.toFixed(2)}ms)\n`,
  );
  assertWithinCiBaseline(stats);
  return stats;
}

const isMain = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  await runMcpStartCiCheck();
}
