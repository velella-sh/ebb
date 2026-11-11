import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { type BenchmarkSuiteResult, compareBenchmarkRuns } from "../tools/bench-compare.js";

const run = promisify(execFile);

function createMockSuite(medianCheckMs: number, platform = "linux", arch = "x64"): BenchmarkSuiteResult {
  return {
    timestamp: new Date().toISOString(),
    nodeVersion: "v22.0.0",
    platform,
    arch,
    results: {
      "data load (all bundled registries)": {
        name: "data load (all bundled registries)",
        iterations: 20,
        minMs: 10.0,
        medianMs: 11.0,
        p99Ms: 15.0,
        opsPerSec: 90,
      },
      "check (single item: pkg:npm/left-pad)": {
        name: "check (single item: pkg:npm/left-pad)",
        iterations: 1000,
        minMs: 0.001,
        medianMs: medianCheckMs,
        p99Ms: 0.005,
        opsPerSec: 500000,
      },
    },
  };
}

test("compareBenchmarkRuns passes when timings are within 20% threshold", () => {
  const baseline = createMockSuite(1.0);
  const current = createMockSuite(1.15); // +15% slowdown

  const report = compareBenchmarkRuns(current, baseline, 0.2);
  assert.equal(report.passed, true);
  assert.equal(report.regressions.length, 0);
  assert.equal(report.comparisons.length, 2);
});

test("compareBenchmarkRuns fails when a benchmark regresses more than 20%", () => {
  const baseline = createMockSuite(1.0);
  const current = createMockSuite(1.25); // +25% slowdown (> 20%)

  const report = compareBenchmarkRuns(current, baseline, 0.2);
  assert.equal(report.passed, false);
  assert.equal(report.regressions.length, 1);
  assert.equal(report.regressions[0]?.name, "check (single item: pkg:npm/left-pad)");
  assert.ok(report.regressions[0]?.diffPercent > 20);
});

test("compareBenchmarkRuns skips comparison when runner architecture mismatches", () => {
  const baseline = createMockSuite(1.0, "linux", "x64");
  const current = createMockSuite(2.0, "darwin", "arm64");

  const report = compareBenchmarkRuns(current, baseline, 0.2);
  assert.equal(report.passed, true);
  assert.equal(report.mismatchedRunner, true);
  assert.equal(report.regressions.length, 0);
});

test("bench-compare CLI exits with code 1 on regression and code 0 when within threshold", async () => {
  const script = resolve("dist/tools/bench-compare.js");
  const tempDir = await mkdtemp(join(tmpdir(), "bench-test-"));

  try {
    const baselinePath = join(tempDir, "baseline.json");
    const fastPath = join(tempDir, "current-fast.json");
    const slowPath = join(tempDir, "current-slow.json");

    await writeFile(baselinePath, JSON.stringify(createMockSuite(1.0, process.platform, process.arch)));
    await writeFile(fastPath, JSON.stringify(createMockSuite(1.05, process.platform, process.arch)));
    await writeFile(slowPath, JSON.stringify(createMockSuite(1.5, process.platform, process.arch)));

    // Fast run: should pass (exit code 0)
    const fastRun = await run(process.execPath, [script, fastPath, baselinePath]);
    assert.match(fastRun.stdout, /All benchmark timings are within acceptable threshold/);

    // Fake slow run: should fail (exit code 1)
    await assert.rejects(
      run(process.execPath, [script, slowPath, baselinePath]),
      (err: { code: number; stderr: string }) => {
        assert.equal(err.code, 1);
        assert.match(err.stderr, /Performance regression detected/);
        return true;
      },
    );

    // Missing baseline: should gracefully exit 0
    const missingBaseline = await run(process.execPath, [script, fastPath, join(tempDir, "non-existent.json")]);
    assert.match(missingBaseline.stdout, /No baseline file found/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
