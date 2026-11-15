/**
 * Cold-start benchmark: process start → MCP initialize answer.
 * Records median ms and fails when slower than baseline by more than 20%.
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertWithinBaseline,
  MCP_START_BASELINE_MEDIAN_MS,
  MCP_START_REGRESSION_THRESHOLD,
} from "../tools/mcp-start-baseline.ts";
import { type BenchmarkStats, computeStats, printBenchmarkTable } from "./harness.ts";

export {
  assertWithinBaseline,
  MCP_START_BASELINE_MEDIAN_MS,
  MCP_START_CI_CEILING_MS,
  MCP_START_REGRESSION_THRESHOLD,
} from "../tools/mcp-start-baseline.ts";

const binPath = resolve(process.cwd(), "dist/src/bin.js");

export async function measureMcpInitializeMs(): Promise<number> {
  const started = process.hrtime.bigint();
  const child = spawn(process.execPath, [binPath, "mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  const response = await new Promise<number>((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timed out waiting for MCP initialize during cold-start bench"));
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
            const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
            clearTimeout(timer);
            resolvePromise(elapsedMs);
          }
        } catch {
          // ignore non-json
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      buffer += `\n[stderr]${chunk.toString("utf8")}`;
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-start-bench", version: "1.0.0" },
        },
      })}\n`,
    );
  });

  child.stdin.end();
  if (child.exitCode === null && !child.killed) {
    child.kill("SIGKILL");
  }
  return response;
}

export async function runMcpStartBenchmark(iterations = 8): Promise<BenchmarkStats> {
  const durations: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    durations.push(await measureMcpInitializeMs());
  }
  return computeStats("mcp cold-start (process → initialize)", durations);
}

export async function runMcpStartBenchmarks(): Promise<BenchmarkStats> {
  console.log("Measuring MCP cold-start (process start → initialize)...");
  const stats = await runMcpStartBenchmark(8);
  printBenchmarkTable([stats]);
  assertWithinBaseline(stats);
  console.log(
    `Within ${MCP_START_REGRESSION_THRESHOLD * 100}% of baseline median ${MCP_START_BASELINE_MEDIAN_MS}ms (limit ${(MCP_START_BASELINE_MEDIAN_MS * (1 + MCP_START_REGRESSION_THRESHOLD)).toFixed(1)}ms).`,
  );
  return stats;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  await runMcpStartBenchmarks();
}
