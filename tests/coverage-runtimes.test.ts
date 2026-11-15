import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assessRuntime,
  checkRuntimeCoverage,
  formatCoverageText,
  type ExpectedRuntime,
} from "../tools/coverage/runtimes.js";
import type { RegistryV2Rule } from "../src/registry.js";

const baseRule = (over: Partial<RegistryV2Rule> & Pick<RegistryV2Rule, "id" | "vers" | "event">): RegistryV2Rule => ({
  ecosystem: "nodejs",
  purl: "pkg:generic/nodejs",
  title: over.id,
  summary: over.id,
  severity: over.event === "scheduled-end-of-life" ? "low" : "high",
  sources: [{ title: "t", url: "https://example.com/", accessedAt: "2026-11-15" }],
  provenance: {
    observedAt: "2026-11-15",
    reviewedAt: "2026-11-15",
    reviewer: "unreviewed",
    method: "manual",
  },
  ...over,
});

test("assessRuntime reports missing end rules and missing scheduled rules", () => {
  const expected: ExpectedRuntime = {
    runtime: "nodejs",
    purl: "pkg:generic/nodejs",
    registry: "nodejs.json",
    scheduleUrl: "https://example.com/schedule",
    reviewedAt: "2026-11-15",
    sources: [],
    lines: [
      { id: "18", sampleVersion: "18.20.0", status: "ended" },
      {
        id: "22",
        sampleVersion: "22.11.0",
        status: "supported",
        end: { date: "2027-04-30", precision: "day" },
        requiresScheduled: true,
      },
      { id: "24", sampleVersion: "24.1.0", status: "policy" },
    ],
  };
  const rules = [
    baseRule({
      id: "nodejs.runtime.eol-18",
      vers: "vers:semver/>=18.0.0|<19.0.0",
      event: "end-of-life",
    }),
    baseRule({
      id: "nodejs.runtime.eol-22",
      vers: "vers:semver/>=22.0.0|<23.0.0",
      event: "end-of-life",
      deadline: "2027-04-30",
    }),
  ];
  const result = assessRuntime(expected, rules);
  assert.equal(result.complete, false);
  assert.deepEqual(result.missingLines, []);
  assert.deepEqual(result.missingScheduled, ["22"]);
});

test("assessRuntime treats a documented coverage limit as complete", () => {
  const result = assessRuntime(
    {
      runtime: "bun",
      purl: "pkg:generic/bun",
      registry: "deno.json",
      scheduleUrl: "https://bun.com/",
      reviewedAt: "2026-11-15",
      sources: [],
      coverageLimit: "No dated policy.",
      lines: [],
    },
    [],
  );
  assert.equal(result.complete, true);
  assert.equal(result.coverageLimit, "No dated policy.");
});

test("checkRuntimeCoverage reads expected JSON against the real registry", async () => {
  const report = await checkRuntimeCoverage();
  assert.ok(report.runtimes.length >= 10);
  assert.ok(report.runtimes.some((r) => r.runtime === "nodejs"));
  assert.ok(report.runtimes.some((r) => r.runtime === "bun" && r.complete));
  const text = formatCoverageText(report);
  assert.match(text, /Runtime release-line coverage/);
  // Today's registry still has gaps for several runtimes; the checker must surface them.
  assert.equal(report.complete, false);
  assert.match(text, /gaps|missing/);
});

test("checkRuntimeCoverage fails closed when an expected line has no rule", async () => {
  const root = await mkdtemp(join(tmpdir(), "ebb-coverage-"));
  try {
    await mkdir(join(root, "tools/coverage/expected"), { recursive: true });
    await mkdir(join(root, "registry"), { recursive: true });
    await writeFile(
      join(root, "tools/coverage/expected/nodejs.json"),
      JSON.stringify({
        runtime: "nodejs",
        purl: "pkg:generic/nodejs",
        registry: "nodejs.json",
        scheduleUrl: "https://example.com/",
        reviewedAt: "2026-11-15",
        sources: [],
        lines: [{ id: "99", sampleVersion: "99.0.0", status: "ended" }],
      }),
    );
    await writeFile(
      join(root, "registry/nodejs.json"),
      JSON.stringify({
        schemaVersion: "ebb.registry.v2",
        ecosystem: "nodejs",
        rules: [
          {
            id: "nodejs.runtime.eol-18",
            ecosystem: "nodejs",
            purl: "pkg:generic/nodejs",
            vers: "vers:semver/>=18.0.0|<19.0.0",
            event: "end-of-life",
            title: "Node.js 18 is end-of-life",
            summary: "ended",
            severity: "high",
            sources: [{ title: "t", url: "https://example.com/", accessedAt: "2026-11-15" }],
            provenance: {
              observedAt: "2026-11-15",
              reviewedAt: "2026-11-15",
              reviewer: "unreviewed",
              method: "manual",
            },
          },
        ],
      }),
    );
    const report = await checkRuntimeCoverage(root);
    assert.equal(report.complete, false);
    assert.deepEqual(report.runtimes[0]?.missingLines, ["99"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
