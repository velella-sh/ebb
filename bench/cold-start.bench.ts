/**
 * Cold-start benchmark measuring module import time and first-call overhead
 * in fresh Node.js processes across Node 22 and 24.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type BenchmarkStats, computeStats, printBenchmarkTable } from "./harness.ts";

export interface NodeTarget {
  name: string;
  bin: string;
  version: string;
}

export function findNodeBinaries(): NodeTarget[] {
  const candidates: Array<{ name: string; paths: string[]; envVar: string }> = [
    {
      name: "Node 22",
      paths: [
        "/opt/homebrew/opt/node@22/bin/node",
        "/usr/local/opt/node@22/bin/node",
      ],
      envVar: "NODE22_BIN",
    },
    {
      name: "Node 24",
      paths: [
        "/opt/homebrew/opt/node@24/bin/node",
        "/usr/local/opt/node@24/bin/node",
      ],
      envVar: "NODE24_BIN",
    },
  ];

  const targets: NodeTarget[] = [];
  for (const candidate of candidates) {
    const fromEnv = process.env[candidate.envVar];
    let binPath: string | undefined = fromEnv && existsSync(fromEnv) ? fromEnv : undefined;
    if (!binPath) {
      binPath = candidate.paths.find((p) => existsSync(p));
    }
    if (binPath) {
      try {
        const ver = execFileSync(binPath, ["--version"], { encoding: "utf8" }).trim();
        targets.push({ name: candidate.name, bin: binPath, version: ver });
      } catch {
        // Ignore unexecutable binary
      }
    }
  }

  return targets;
}

export function measureFreshImport(nodeBin: string, iterations = 10): BenchmarkStats {
  const distPath = resolve(fileURLToPath(new URL("../dist/src/index.js", import.meta.url)));
  const script = `
    const t0 = process.hrtime.bigint();
    await import(${JSON.stringify(distPath)});
    const t1 = process.hrtime.bigint();
    console.log(Number(t1 - t0) / 1e6);
  `;

  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const out = execFileSync(nodeBin, ["--input-type=module", "-e", script], {
      encoding: "utf8",
    }).trim();
    durations.push(parseFloat(out));
  }

  return computeStats(`import (${nodeBin})`, durations);
}

export function measureColdCheck(nodeBin: string, iterations = 10): {
  importStats: BenchmarkStats;
  firstCheckStats: BenchmarkStats;
  totalColdStats: BenchmarkStats;
} {
  const distPath = resolve(fileURLToPath(new URL("../dist/src/index.js", import.meta.url)));
  const script = `
    const t0 = process.hrtime.bigint();
    const { check } = await import(${JSON.stringify(distPath)});
    const t1 = process.hrtime.bigint();
    check('pkg:npm/left-pad', '1.3.0');
    const t2 = process.hrtime.bigint();
    console.log(JSON.stringify({
      importMs: Number(t1 - t0) / 1e6,
      checkMs: Number(t2 - t1) / 1e6,
      totalMs: Number(t2 - t0) / 1e6,
    }));
  `;

  const importTimes: number[] = [];
  const checkTimes: number[] = [];
  const totalTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const raw = execFileSync(nodeBin, ["--input-type=module", "-e", script], {
      encoding: "utf8",
    }).trim();
    const parsed = JSON.parse(raw) as { importMs: number; checkMs: number; totalMs: number };
    importTimes.push(parsed.importMs);
    checkTimes.push(parsed.checkMs);
    totalTimes.push(parsed.totalMs);
  }

  return {
    importStats: computeStats(`cold import`, importTimes),
    firstCheckStats: computeStats(`first check()`, checkTimes),
    totalColdStats: computeStats(`total cold start`, totalTimes),
  };
}

export function runColdStartBenchmarks(): void {
  const targets = findNodeBinaries();
  if (targets.length === 0) {
    console.warn("No Node 22 or Node 24 binaries found. Set NODE22_BIN or NODE24_BIN to measure.");
    return;
  }

  const allStats: BenchmarkStats[] = [];

  for (const target of targets) {
    console.log(`\nMeasuring cold start on ${target.name} (${target.version})...`);
    const results = measureColdCheck(target.bin, 10);
    allStats.push({
      ...results.importStats,
      name: `${target.name} (${target.version}) - import`,
    });
    allStats.push({
      ...results.firstCheckStats,
      name: `${target.name} (${target.version}) - first check()`,
    });
    allStats.push({
      ...results.totalColdStats,
      name: `${target.name} (${target.version}) - total cold start`,
    });
  }

  console.log("\nCold Start Results:");
  printBenchmarkTable(allStats);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  runColdStartBenchmarks();
}
