import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { applyAsOf } from "../src/as-of.js";
import { bundledRules } from "../src/bundled-rules.js";
import type { LifecycleScan } from "../src/domain.js";
import { applyMinSupport, parseMinSupportDays } from "../src/min-support.js";
import { findPackageFile, findPackageFileSync } from "../src/package-files.js";
import type { RegistryV2Rule } from "../src/registry.js";

test("applyMinSupport elevates low/info findings inside window and parses option bounds", () => {
  assert.equal(parseMinSupportDays("0"), 0);
  assert.equal(parseMinSupportDays("3650"), 3650);
  assert.equal(parseMinSupportDays("3651"), undefined);
  assert.equal(parseMinSupportDays("-5"), undefined);
  assert.equal(parseMinSupportDays("abc"), undefined);

  const scan: LifecycleScan = {
    root: ".",
    findings: [
      {
        id: "in-window-low",
        ruleId: "r1",
        detector: "nodejs",
        title: "t1",
        summary: "Node 22 ends",
        severity: "low",
        deadline: "2026-05-01",
        location: { path: ".nvmrc" },
        sources: [],
      },
      {
        id: "in-window-high",
        ruleId: "r2",
        detector: "nodejs",
        title: "t2",
        summary: "Already high",
        severity: "high",
        deadline: "2026-05-01",
        location: { path: "Dockerfile" },
        sources: [],
      },
      {
        id: "outside-window",
        ruleId: "r3",
        detector: "nodejs",
        title: "t3",
        summary: "Later",
        severity: "info",
        deadline: "2028-01-01",
        location: { path: "package.json" },
        sources: [],
      },
    ],
  };

  const updated = applyMinSupport(scan, 60, "2026-04-01");
  assert.equal(updated.findings[0]!.severity, "medium");
  assert.match(updated.findings[0]!.summary, /^Support ends 2026-05-01, within 60 days\. Node 22 ends$/);
  assert.equal(updated.findings[1]!.severity, "high");
  assert.equal(updated.findings[2]!.severity, "info");
});

test("applyAsOf elevates scheduled-end-of-life findings whose deadline has passed", async () => {
  const rules: RegistryV2Rule[] = [
    {
      id: "sched.reached",
      ecosystem: "nodejs",
      purl: "pkg:generic/nodejs",
      vers: "vers:semver/*",
      event: "scheduled-end-of-life",
      title: "Scheduled EOL",
      summary: "Ends",
      severity: "low",
      deadline: "2026-04-30",
      sources: [{ title: "s", url: "https://example.com", accessedAt: "2026-01-01" }],
      provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
    },
  ];
  const scan: LifecycleScan = {
    root: ".",
    findings: [
      {
        id: "a",
        ruleId: "sched.reached",
        detector: "nodejs",
        title: "t",
        summary: "Original summary.",
        severity: "low",
        deadline: "2026-04-30",
        location: { path: "package.json" },
        sources: [],
      },
      {
        id: "b",
        ruleId: "other.rule",
        detector: "npm",
        title: "t2",
        summary: "Unchanged.",
        severity: "low",
        location: { path: "package.json" },
        sources: [],
      },
    ],
  };

  const projected = await applyAsOf(scan, "2026-05-01", rules);
  assert.equal(projected.asOf, "2026-05-01");
  assert.equal(projected.findings[0]!.severity, "high");
  assert.match(projected.findings[0]!.summary, /^As of 2026-05-01, this has ended \(deadline 2026-04-30\)\./);
  assert.equal(projected.findings[1]!.severity, "low");
});

test("bundledRules loads validated core rules", async () => {
  const first = await bundledRules();
  const second = await bundledRules();
  assert.deepEqual(first, second);
  assert.ok(first.length > 0);
  assert.ok(first.some((rule) => rule.ecosystem === "nodejs"));
});

test("findPackageFile resolves shipped assets async and rejects missing files", async () => {
  const moduleUrl = pathToFileURL(process.cwd() + "/dist/src/index.js").href;
  const asyncPath = await findPackageFile("package.json", moduleUrl);
  const syncPath = findPackageFileSync("package.json", moduleUrl);
  assert.equal(asyncPath, syncPath);

  await assert.rejects(() => findPackageFile("nonexistent-ebb-file-xyz.json", moduleUrl), /Ebb package file not found/);
  assert.throws(() => findPackageFileSync("nonexistent-ebb-file-xyz.json", moduleUrl), /Ebb package file not found/);
});
