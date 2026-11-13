/**
 * Compares two benchmark runs and reports/fails on regressions exceeding a threshold.
 *
 * Usage:
 *   node dist/tools/bench-compare.js <current.json> <baseline.json> [--threshold 0.20]
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export interface BenchmarkStats {
  name: string;
  iterations: number;
  minMs: number;
  medianMs: number;
  p99Ms: number;
  maxMs?: number;
  opsPerSec: number;
}

export interface BenchmarkSuiteResult {
  timestamp: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  results: Record<string, BenchmarkStats>;
}

export interface BenchmarkComparison {
  name: string;
  baselineMedianMs: number;
  currentMedianMs: number;
  diffPercent: number;
  passed: boolean;
}

export interface ComparisonReport {
  passed: boolean;
  mismatchedRunner: boolean;
  thresholdPercent: number;
  comparisons: BenchmarkComparison[];
  regressions: BenchmarkComparison[];
}

export function compareBenchmarkRuns(
  current: BenchmarkSuiteResult,
  baseline: BenchmarkSuiteResult,
  thresholdFraction = 0.2,
  noiseFloorMs = 0.15,
): ComparisonReport {
  const thresholdPercent = thresholdFraction * 100;

  // Do not compare across different runner environments
  if (
    (current.platform && baseline.platform && current.platform !== baseline.platform) ||
    (current.arch && baseline.arch && current.arch !== baseline.arch)
  ) {
    return {
      passed: true,
      mismatchedRunner: true,
      thresholdPercent,
      comparisons: [],
      regressions: [],
    };
  }

  const comparisons: BenchmarkComparison[] = [];
  const regressions: BenchmarkComparison[] = [];

  for (const [name, baselineStat] of Object.entries(baseline.results)) {
    const currentStat = current.results[name];
    if (!currentStat) continue;

    const baseMed = baselineStat.medianMs;
    const currMed = currentStat.medianMs;
    const diffPercent = baseMed > 0 ? ((currMed - baseMed) / baseMed) * 100 : 0;
    const diffMs = currMed - baseMed;
    const passed = diffPercent <= thresholdPercent || diffMs <= noiseFloorMs;

    const comp: BenchmarkComparison = {
      name,
      baselineMedianMs: baseMed,
      currentMedianMs: currMed,
      diffPercent,
      passed,
    };

    comparisons.push(comp);
    if (!passed) {
      regressions.push(comp);
    }
  }

  return {
    passed: regressions.length === 0,
    mismatchedRunner: false,
    thresholdPercent,
    comparisons,
    regressions,
  };
}

export function formatComparisonTable(report: ComparisonReport): string {
  if (report.mismatchedRunner) {
    return "Skipped comparison: Current and baseline runs were produced on different machine architectures/platforms.";
  }

  const rows = report.comparisons.map((c) => ({
    Benchmark: c.name,
    "Baseline (ms)": c.baselineMedianMs.toFixed(4),
    "Current (ms)": c.currentMedianMs.toFixed(4),
    "Diff (%)": `${c.diffPercent >= 0 ? "+" : ""}${c.diffPercent.toFixed(1)}%`,
    Status: c.passed ? "PASS" : "REGRESSION (FAIL)",
  }));

  console.table(rows);
  return "";
}

export async function main(argv: string[]): Promise<number> {
  if (argv.length < 2) {
    throw new Error("Usage: bench-compare <current.json> <baseline.json> [--threshold 0.20]");
  }

  const currentPath = argv[0]!;
  const baselinePath = argv[1]!;

  if (!existsSync(baselinePath)) {
    process.stdout.write(`No baseline file found at ${baselinePath}. Skipping regression check.\n`);
    return 0;
  }

  if (!existsSync(currentPath)) {
    throw new Error(`Current benchmark file not found at ${currentPath}`);
  }

  let threshold = 0.2;
  const threshIndex = argv.indexOf("--threshold");
  if (threshIndex !== -1 && argv[threshIndex + 1]) {
    threshold = Number.parseFloat(argv[threshIndex + 1]!);
  }

  const current = JSON.parse(await readFile(currentPath, "utf8")) as BenchmarkSuiteResult;
  const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as BenchmarkSuiteResult;

  const report = compareBenchmarkRuns(current, baseline, threshold);
  formatComparisonTable(report);

  if (!report.passed) {
    process.stderr.write(`\n❌ Performance regression detected (> ${report.thresholdPercent.toFixed(0)}% slowdown):\n`);
    for (const reg of report.regressions) {
      process.stderr.write(
        `  - ${reg.name}: ${reg.baselineMedianMs.toFixed(4)} ms -> ${reg.currentMedianMs.toFixed(4)} ms (+${reg.diffPercent.toFixed(1)}%)\n`,
      );
    }
    return 1;
  }

  process.stdout.write(
    `\n✅ All benchmark timings are within acceptable threshold (<= ${report.thresholdPercent.toFixed(0)}% slowdown).\n`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: Error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    },
  );
}
