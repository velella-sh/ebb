import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assessRuntime,
  checkRuntimeCoverage,
  deadlineMatchesOfficial,
  EXIT_GAPS,
  formatCoverageText,
  ruleCoversLineRange,
  type ExpectedRuntime,
} from "../tools/coverage/runtimes.js";
import type { RegistryV2Rule } from "../src/registry.js";

const baseRule = (over: Partial<RegistryV2Rule> & Pick<RegistryV2Rule, "id" | "vers" | "event">): RegistryV2Rule => ({
  ecosystem: "nodejs",
  purl: "pkg:generic/nodejs",
  title: over.id,
  summary: over.id,
  severity: over.event === "scheduled-end-of-life" ? "low" : "high",
  replacement: "A supported Node.js release",
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
      { id: "18", sampleVersion: "18.20.0", lineVers: "vers:semver/>=18.0.0|<19.0.0", status: "ended" },
      {
        id: "22",
        sampleVersion: "22.11.0",
        lineVers: "vers:semver/>=22.0.0|<23.0.0",
        status: "supported",
        end: { date: "2027-04-30", precision: "day" },
        requiresScheduled: true,
      },
      { id: "24", sampleVersion: "24.1.0", lineVers: "vers:semver/>=24.0.0|<25.0.0", status: "policy" },
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

test("assessRuntime skips supported lines without a fixed EOL (Temurin at-least floors)", () => {
  const result = assessRuntime(
    {
      runtime: "java",
      purl: "pkg:generic/java",
      registry: "java.json",
      scheduleUrl: "https://adoptium.net/support/",
      reviewedAt: "2026-11-15",
      sources: [],
      lines: [
        { id: "11", sampleVersion: "11.0.33", lineVers: "vers:semver/>=11.0.0|<12.0.0", status: "supported" },
        { id: "17", sampleVersion: "17.0.21", lineVers: "vers:semver/>=17.0.0|<18.0.0", status: "supported" },
        { id: "21", sampleVersion: "21.0.13", lineVers: "vers:semver/>=21.0.0|<22.0.0", status: "supported" },
        { id: "25", sampleVersion: "25.0.5", lineVers: "vers:semver/>=25.0.0|<26.0.0", status: "supported" },
      ],
    },
    [],
  );
  assert.equal(result.complete, true);
  assert.deepEqual(result.gaps, []);
});

test("an exact 26.0.0 rule does not cover the Node.js 26 release line", () => {
  const lineVers = "vers:semver/>=26.0.0|<27.0.0";
  assert.equal(ruleCoversLineRange("vers:semver/26.0.0", lineVers), false);
  assert.equal(ruleCoversLineRange("vers:semver/>=26.0.0|<27.0.0", lineVers), true);

  const expected: ExpectedRuntime = {
    runtime: "nodejs",
    purl: "pkg:generic/nodejs",
    registry: "nodejs.json",
    scheduleUrl: "https://example.com/",
    reviewedAt: "2026-11-15",
    sources: [],
    lines: [
      {
        id: "26",
        sampleVersion: "26.0.0",
        lineVers,
        status: "supported",
        end: { date: "2029-04-30", precision: "day" },
        requiresScheduled: true,
      },
    ],
  };
  const rules = [
    baseRule({
      id: "nodejs.runtime.eol-26-exact",
      vers: "vers:semver/26.0.0",
      event: "scheduled-end-of-life",
      deadline: "2029-04-30",
    }),
  ];
  const result = assessRuntime(expected, rules);
  assert.equal(result.complete, false);
  assert.equal(result.gaps[0]?.kind, "incomplete-range");
});

test("line coverage rejects holes and handles unbounded and exclusive endpoints", () => {
  const line = "vers:semver/>=26.0.0|<27.0.0";
  assert.equal(ruleCoversLineRange("vers:semver/>=26.0.0|!=26.0.2|<27.0.0", line), false);
  assert.equal(ruleCoversLineRange("vers:semver/!=27.0.0|>=26.0.0", line), true);
  assert.equal(ruleCoversLineRange("vers:semver/>26.0.0|<27.0.0", line), false);
  assert.equal(ruleCoversLineRange("vers:semver/>=26.0.0|<26.0.2|>=26.0.3|<27.0.0", line), false);
  assert.equal(ruleCoversLineRange("vers:semver/>=1.10.0|<1.99.0", "vers:semver/<1.99.0"), false);
  assert.equal(ruleCoversLineRange("vers:semver/*", "vers:semver/<1.99.0"), true);
});

test("a wrongly dated scheduled rule is not rescued by a correctly dated non-scheduled rule", () => {
  const lineVers = "vers:semver/>=22.0.0|<23.0.0";
  const expected: ExpectedRuntime = {
    runtime: "nodejs",
    purl: "pkg:generic/nodejs",
    registry: "nodejs.json",
    scheduleUrl: "https://example.com/",
    reviewedAt: "2026-11-15",
    sources: [],
    lines: [
      {
        id: "22",
        sampleVersion: "22.11.0",
        lineVers,
        status: "supported",
        end: { date: "2027-04-30", precision: "day" },
        requiresScheduled: true,
      },
    ],
  };
  const rules = [
    baseRule({
      id: "nodejs.runtime.eol-22-scheduled-wrong",
      vers: lineVers,
      event: "scheduled-end-of-life",
      deadline: "2027-05-01",
    }),
    baseRule({
      id: "nodejs.runtime.eol-22-ended-correct",
      vers: lineVers,
      event: "end-of-life",
      deadline: "2027-04-30",
    }),
  ];
  assert.equal(deadlineMatchesOfficial("2027-05-01", { date: "2027-04-30", precision: "day" }), false);
  const result = assessRuntime(expected, rules);
  assert.equal(result.complete, false);
  assert.equal(result.gaps[0]?.kind, "deadline-mismatch");
});

test("checkRuntimeCoverage reads expected JSON against the real registry", async () => {
  const report = await checkRuntimeCoverage();
  assert.ok(report.runtimes.length >= 10);
  assert.ok(report.runtimes.some((r) => r.runtime === "nodejs"));
  assert.ok(report.runtimes.some((r) => r.runtime === "bun" && r.complete));
  const java = report.runtimes.find((r) => r.runtime === "java");
  assert.ok(java, "java expected runtime must be present");
  const text = formatCoverageText(report);
  assert.match(text, /Runtime release-line coverage/);
  // Tip of the stack is complete; intermediate PRs soften this assertion.
  assert.equal(report.complete, true);
  assert.ok(java.complete, "java including Temurin LTS without fixed EOL must be complete");
  assert.match(text, /All in-scope runtimes are complete/);
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
        lines: [{ id: "99", sampleVersion: "99.0.0", lineVers: "vers:semver/>=99.0.0|<100.0.0", status: "ended" }],
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
            replacement: "A supported Node.js release",
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

test("exact 26.0.0 and wrong-scheduled fixtures leave coverage incomplete (CLI exit 1)", async () => {
  assert.equal(EXIT_GAPS, 1);
  for (const fixture of [
    {
      name: "exact-26",
      lines: [
        {
          id: "26",
          sampleVersion: "26.0.0",
          lineVers: "vers:semver/>=26.0.0|<27.0.0",
          status: "supported" as const,
          end: { date: "2029-04-30", precision: "day" as const },
          requiresScheduled: true,
        },
      ],
      rules: [
        {
          id: "nodejs.runtime.eol-26-exact",
          vers: "vers:semver/26.0.0",
          event: "scheduled-end-of-life",
          title: "exact only",
          summary: "exact",
          severity: "low",
          deadline: "2029-04-30",
        },
      ],
      kind: "incomplete-range",
    },
    {
      name: "wrong-scheduled",
      lines: [
        {
          id: "22",
          sampleVersion: "22.11.0",
          lineVers: "vers:semver/>=22.0.0|<23.0.0",
          status: "supported" as const,
          end: { date: "2027-04-30", precision: "day" as const },
          requiresScheduled: true,
        },
      ],
      rules: [
        {
          id: "nodejs.runtime.eol-22-scheduled-wrong",
          vers: "vers:semver/>=22.0.0|<23.0.0",
          event: "scheduled-end-of-life",
          title: "wrong day",
          summary: "wrong",
          severity: "low",
          deadline: "2027-05-01",
        },
        {
          id: "nodejs.runtime.eol-22-ended-correct",
          vers: "vers:semver/>=22.0.0|<23.0.0",
          event: "end-of-life",
          title: "correct day non-scheduled",
          summary: "correct",
          severity: "high",
          deadline: "2027-04-30",
        },
      ],
      kind: "deadline-mismatch",
    },
  ]) {
    const root = await mkdtemp(join(tmpdir(), `ebb-coverage-${fixture.name}-`));
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
          lines: fixture.lines,
        }),
      );
      await writeFile(
        join(root, "registry/nodejs.json"),
        JSON.stringify({
          schemaVersion: "ebb.registry.v2",
          ecosystem: "nodejs",
          rules: fixture.rules.map((rule) => ({
            ecosystem: "nodejs",
            purl: "pkg:generic/nodejs",
            replacement: "A supported Node.js release",
            sources: [{ title: "t", url: "https://example.com/", accessedAt: "2026-11-15" }],
            provenance: {
              observedAt: "2026-11-15",
              reviewedAt: "2026-11-15",
              reviewer: "unreviewed",
              method: "manual",
            },
            ...rule,
          })),
        }),
      );
      const report = await checkRuntimeCoverage(root);
      assert.equal(report.complete, false, fixture.name);
      assert.equal(report.runtimes[0]?.gaps[0]?.kind, fixture.kind, fixture.name);
      assert.match(formatCoverageText(report), new RegExp(fixture.kind));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("check() and upcoming() preserve month precision for Python 3.11–3.16", async () => {
  const { check, upcoming } = await import("../src/index.js");
  for (const [version, month] of [
    ["3.11.10", "2027-10"],
    ["3.12.7", "2028-10"],
    ["3.13.0", "2029-10"],
    ["3.14.0", "2030-10"],
    ["3.15.0", "2031-10"],
    ["3.16.0", "2032-10"],
  ] as const) {
    const result = check("pkg:generic/python", version);
    const match = result.matches.find(
      (m) => m.ruleId === `python.runtime.eol-${version.split(".").slice(0, 2).join(".")}`,
    );
    assert.ok(match, `expected scheduled match for ${version}`);
    assert.equal(match.datePrecision, "month");
    assert.ok(match.date?.startsWith(month), `date ${match.date} should start with ${month}`);
  }

  const upcomingResult = upcoming({ within: "2500d", ecosystem: "python", asOf: "2026-11-15" });
  for (const month of ["2027-10", "2028-10", "2029-10", "2030-10", "2031-10", "2032-10"] as const) {
    const item = upcomingResult.items.find(
      (i) => i.deadline.startsWith(month) && i.ruleId.startsWith("python.runtime.eol-3."),
    );
    assert.ok(item, `upcoming missing Python month ${month}`);
    assert.equal(item.datePrecision, "month");
  }
});

test("check() and upcoming() cover scheduled Node.js 27", async () => {
  const { check, upcoming } = await import("../src/index.js");
  const result = check("pkg:generic/nodejs", "27.0.0");
  const match = result.matches.find((m) => m.ruleId === "nodejs.runtime.eol-27");
  assert.ok(match, "expected scheduled match for Node.js 27");
  assert.equal(match.event, "scheduled");
  assert.equal(match.date, "2030-04-30");

  const upcomingResult = upcoming({ within: "1500d", ecosystem: "nodejs", asOf: "2026-11-27" });
  const item = upcomingResult.items.find((i) => i.ruleId === "nodejs.runtime.eol-27");
  assert.ok(item, "upcoming missing Node.js 27 deadline");
  assert.equal(item.deadline, "2030-04-30");
});
