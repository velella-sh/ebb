import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  assertWithinBaseline,
  assertWithinCiBaseline,
  MCP_START_BASELINE_MEDIAN_MS,
  MCP_START_CI_BASELINE_MEDIAN_MS,
  MCP_START_CI_CEILING_MS,
  MCP_START_REGRESSION_THRESHOLD,
  regressionLimitMs,
} from "../tools/mcp-start-baseline.js";

describe("MCP cold-start bench", () => {
  it("fails when median regresses more than 20% over the local baseline", () => {
    const over = MCP_START_BASELINE_MEDIAN_MS * (1 + MCP_START_REGRESSION_THRESHOLD) + 1;
    assert.throws(() => assertWithinBaseline({ medianMs: over }), /MCP cold-start regression/);
    assert.doesNotThrow(() =>
      assertWithinBaseline({
        medianMs: MCP_START_BASELINE_MEDIAN_MS * (1 + MCP_START_REGRESSION_THRESHOLD),
      }),
    );
  });

  it("fails when median regresses more than 20% over the ubuntu-latest CI baseline", () => {
    const limit = regressionLimitMs(MCP_START_CI_BASELINE_MEDIAN_MS, MCP_START_REGRESSION_THRESHOLD);
    assert.equal(MCP_START_REGRESSION_THRESHOLD, 0.2);
    assert.throws(() => assertWithinCiBaseline({ medianMs: limit + 1 }), /MCP cold-start regression/);
    assert.doesNotThrow(() => assertWithinCiBaseline({ medianMs: MCP_START_CI_BASELINE_MEDIAN_MS }));
    assert.throws(() => assertWithinCiBaseline({ medianMs: MCP_START_CI_CEILING_MS + 1 }), /absolute CI ceiling/);
  });

  it("wires the CI 20% gate into npm run bench (Benchmark workflow path)", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { scripts: { bench: string } };
    assert.match(pkg.scripts.bench, /mcp-start-ci-check/);
    assert.match(pkg.scripts.bench, /dist\/tools\/mcp-start-ci-check\.js/);

    const workflow = readFileSync(resolve(".github/workflows/bench.yml"), "utf8");
    assert.match(workflow, /npm run bench/);
    assert.match(workflow, /ubuntu-latest/);

    const ciCheck = readFileSync(resolve("tools/mcp-start-ci-check.ts"), "utf8");
    assert.match(ciCheck, /assertWithinCiBaseline/);
    assert.match(ciCheck, /MCP_START_CI_BASELINE_MEDIAN_MS/);
    assert.match(ciCheck, /MCP_START_REGRESSION_THRESHOLD/);
  });
});
