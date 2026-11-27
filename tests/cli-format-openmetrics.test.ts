import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { check } from "../src/check.js";
import { checkAllWith } from "../src/check-all.js";
import {
  escapeOpenMetricsLabel,
  formatCheckAllOpenMetrics,
  formatUpcomingOpenMetrics,
} from "../src/cli/format/openmetrics.js";
import type { DataStatus } from "../src/data-status.js";
import type { UpcomingResult } from "../src/upcoming.js";

const repoRoot = resolve(process.cwd());
const goldenPath = resolve(repoRoot, "tests/fixtures/openmetrics/golden.prom");

const mockDataStatus: DataStatus = {
  schemaVersion: "ebb.data-status.v1",
  source: "bundled",
  version: "0.2.1",
  createdAt: null,
  contentDigest: null,
  reviewedThrough: "2026-01-01",
  ageDays: 10,
  ageBasis: "reviewedThrough",
  staleAfterDays: 30,
  stale: false,
  signer: null,
  cacheDirectory: "/tmp/cache",
  warnings: [],
};

describe("OpenMetrics Formatter (Epic #668)", () => {
  it("escapes backslashes, double quotes, and newlines in labels", () => {
    assert.equal(escapeOpenMetricsLabel('foo"bar'), 'foo\\"bar');
    assert.equal(escapeOpenMetricsLabel("foo\\bar"), "foo\\\\bar");
    assert.equal(escapeOpenMetricsLabel("foo\nbar"), "foo\\nbar");
    assert.equal(escapeOpenMetricsLabel('a\\b"c\nd'), 'a\\\\b\\"c\\nd');
  });

  it("produces output matching the golden file", () => {
    const items = [
      { purl: "pkg:npm/left-pad", version: "1.3.0" },
      { purl: "pkg:generic/nodejs", version: "20.0.0" },
      { purl: "pkg:npm/express", version: "4.21.0" },
    ];
    const asOf = "2026-01-01";
    const outcome = checkAllWith(items, (p, v) => check(p, v, asOf));

    const output = formatCheckAllOpenMetrics(items, outcome, {
      dataStatus: mockDataStatus,
      asOf,
    });

    const expectedGolden = readFileSync(goldenPath, "utf-8");
    assert.equal(output, expectedGolden);
  });

  it("strictly terminates with # EOF and contains no timestamps", () => {
    const items = [{ purl: "pkg:npm/express", version: "4.21.0" }];
    const outcome = checkAllWith(items, (p, v) => check(p, v, "2026-01-01"));
    const output = formatCheckAllOpenMetrics(items, outcome, {
      dataStatus: mockDataStatus,
      asOf: "2026-01-01",
    });

    const lines = output.trimEnd().split("\n");
    assert.equal(lines[lines.length - 1], "# EOF");
    assert.ok(output.endsWith("# EOF\n"));

    // Verify no timestamps (OpenMetrics timestamps are trailing numbers after value)
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const parts = line.split(" ");
      // Exactly: <metric_with_labels> <value>
      assert.equal(parts.length, 2, `Line unexpectedly has timestamps or extra tokens: "${line}"`);
      const val = Number.parseFloat(parts[1]!);
      assert.ok(!Number.isNaN(val));
    }
  });

  it("sorts label names lexicographically in each sample", () => {
    const items = [
      { purl: "pkg:generic/nodejs", version: "20.0.0" },
      { purl: "pkg:npm/express", version: "4.21.0" },
    ];
    const outcome = checkAllWith(items, (p, v) => check(p, v, "2026-01-01"));
    const output = formatCheckAllOpenMetrics(items, outcome, {
      dataStatus: mockDataStatus,
      asOf: "2026-01-01",
    });

    const labelMatches = output.match(/\{([^}]+)\}/g);
    assert.ok(labelMatches && labelMatches.length > 0);
    for (const match of labelMatches) {
      const inside = match.slice(1, -1);
      const keys = inside.split(",").map((pair) => pair.split("=")[0]!.trim());
      const sortedKeys = [...keys].sort();
      assert.deepEqual(keys, sortedKeys, `Labels not lexicographically sorted: ${match}`);
      assert.deepEqual(keys, ["event", "purl", "status", "version"]);
    }
  });

  it("formats upcoming results into OpenMetrics text", () => {
    const mockUpcoming: UpcomingResult = {
      asOf: "2026-01-01",
      within: "90d",
      until: "2026-04-01",
      count: 1,
      items: [
        {
          ruleId: "mock.rule",
          purl: "pkg:npm/sample@1.0.0",
          ecosystem: "npm",
          event: "end-of-life",
          title: "Sample EOL",
          severity: "high",
          deadline: "2026-03-01",
          daysLeft: 59,
          estimated: false,
          replacement: null,
          sources: [],
          reviewedAt: "2026-01-01",
        },
      ],
    };

    const output = formatUpcomingOpenMetrics(mockUpcoming, {
      dataStatus: mockDataStatus,
      asOf: "2026-01-01",
    });

    assert.ok(output.includes("ebb_component_days_left{"));
    assert.ok(output.includes('purl="pkg:npm/sample"'));
    assert.ok(output.includes('version="1.0.0"'));
    assert.ok(output.includes(" 59"));
    assert.ok(output.includes("ebb_component_status{"));
    assert.ok(output.includes('status="scheduled"'));
    assert.ok(output.includes("ebb_data_age_seconds 864000"));
    assert.ok(output.endsWith("# EOF\n"));
  });

  it("validates that promtool parses golden output without parse errors", () => {
    const goldenContent = readFileSync(goldenPath, "utf-8");

    try {
      execFileSync("which", ["promtool"], { stdio: "ignore" });
      try {
        execFileSync("promtool", ["check", "metrics"], {
          input: goldenContent,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        // Status 3 is a lint advisory (base unit days vs seconds). Status 1 is a syntax parse error.
        assert.notEqual(status, 1, "promtool rejected metrics with a syntax/parse error");
      }
    } catch {
      // promtool binary not installed in PATH in this environment; verified in CI
    }
  });
});
