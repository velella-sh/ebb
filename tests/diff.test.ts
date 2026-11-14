import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import {
  diff,
  diffRules,
  formatDiffMarkdown,
  formatDiffText,
  DiffError,
  DATA_DIFF_SCHEMA_VERSION,
} from "../src/diff.js";
import type { RegistryV2Rule } from "../src/registry.js";

let tempDir = "";

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ebb-diff-test-"));
});

after(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

const baseRule1: RegistryV2Rule = {
  id: "npm.package.request.deprecated",
  ecosystem: "npm",
  purl: "pkg:npm/request",
  vers: "vers:npm/*",
  event: "deprecated",
  title: "Request is deprecated",
  summary: "Request was deprecated in 2020.",
  deadline: "2020-02-11",
  severity: "low",
  sources: [{ title: "Blog post", url: "https://example.com/blog", accessedAt: "2020-02-11" }],
  provenance: { observedAt: "2020-02-11", reviewedAt: "2020-02-11", reviewer: "alice" },
};

const baseRule2: RegistryV2Rule = {
  id: "pypi.package.django.end-of-support",
  ecosystem: "python",
  purl: "pkg:pypi/django",
  vers: "vers:pypi/<3.2",
  event: "end-of-support",
  title: "Django < 3.2 unsupported",
  summary: "Extended support ended.",
  deadline: "2024-04-01",
  severity: "medium",
  replacement: "pkg:pypi/django@4.2",
  sources: [{ title: "Django LTS", url: "https://example.com/django", accessedAt: "2024-04-01" }],
  provenance: { observedAt: "2024-04-01", reviewedAt: "2024-04-01", reviewer: "bob" },
};

test("diffRules compares identical rulesets and yields empty diff", () => {
  const result = diffRules([baseRule1, baseRule2], [baseRule1, baseRule2]);
  assert.equal(result.schemaVersion, DATA_DIFF_SCHEMA_VERSION);
  assert.equal(result.summary.totalFrom, 2);
  assert.equal(result.summary.totalTo, 2);
  assert.equal(result.summary.added, 0);
  assert.equal(result.summary.changed, 0);
  assert.equal(result.summary.removed, 0);
  assert.equal(result.summary.renamed, 0);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.changed, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.renamed, []);

  const md = formatDiffMarkdown(result);
  assert.ok(md.includes("No changes between versions"));

  const txt = formatDiffText(result, { color: false });
  assert.ok(txt.includes("No changes between versions"));
});

test("diffRules identifies added and removed rules", () => {
  const rule3: RegistryV2Rule = {
    id: "cargo.package.rand.eol",
    ecosystem: "cargo",
    purl: "pkg:cargo/rand",
    vers: "vers:cargo/<0.4.0",
    event: "end-of-life",
    title: "Rand ancient versions EOL",
    summary: "Rand ancient versions reached end of life.",
    severity: "medium",
    sources: [{ title: "Docs", url: "https://example.com/rand", accessedAt: "2025-01-01" }],
    provenance: { observedAt: "2025-01-01", reviewedAt: "2025-01-01", reviewer: "charlie" },
  };

  const from = [baseRule1, baseRule2];
  const to = [baseRule1, rule3]; // baseRule2 removed, rule3 added

  const result = diffRules(from, to);
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.removed, 1);
  assert.equal(result.summary.changed, 0);
  assert.equal(result.summary.renamed, 0);
  assert.equal(result.added[0]?.id, rule3.id);
  assert.equal(result.removed[0]?.id, baseRule2.id);
  assert.equal(result.summary.byEcosystem.cargo?.added, 1);
  assert.equal(result.summary.byEcosystem.python?.removed, 1);
});

test("diffRules tracks field-level changes: deadline shifts, event, vers, sources, and review", () => {
  const modifiedRule1: RegistryV2Rule = {
    ...baseRule1,
    deadline: "2020-03-12", // shifted by +30 days
    event: "end-of-support", // changed event
    vers: "vers:npm/<3.0.0", // changed vers
    sources: [
      { title: "Blog post", url: "https://example.com/blog", accessedAt: "2020-02-11" },
      { title: "GitHub issue", url: "https://example.com/issue-99", accessedAt: "2020-03-12" },
    ],
    provenance: { observedAt: "2020-02-11", reviewedAt: "2020-03-12", reviewer: "dave" },
  };

  const result = diffRules([baseRule1], [modifiedRule1]);
  assert.equal(result.summary.changed, 1);
  assert.equal(result.summary.added, 0);
  assert.equal(result.summary.removed, 0);

  const changed = result.changed[0]!;
  assert.equal(changed.id, baseRule1.id);
  assert.equal(changed.ecosystem, "npm");

  const deadlineChange = changed.changes.find((c) => c.field === "deadline");
  assert.ok(deadlineChange);
  assert.equal(deadlineChange.shiftDays, 30);
  assert.ok(deadlineChange.description?.includes("extended by 30 days"));

  const eventChange = changed.changes.find((c) => c.field === "event");
  assert.ok(eventChange);
  assert.equal(eventChange.from, "deprecated");
  assert.equal(eventChange.to, "end-of-support");

  const versChange = changed.changes.find((c) => c.field === "vers");
  assert.ok(versChange);
  assert.equal(versChange.from, "vers:npm/*");
  assert.equal(versChange.to, "vers:npm/<3.0.0");

  const sourcesChange = changed.changes.find((c) => c.field === "sources");
  assert.ok(sourcesChange);
  assert.ok(sourcesChange.description?.includes("+1"));

  const provChange = changed.changes.find((c) => c.field === "provenance");
  assert.ok(provChange);
  assert.ok(provChange.description?.includes("dave"));
});

test("diffRules detects renamed rule ids explicitly and heuristically", () => {
  // 1. Explicit rename with renamedFrom
  const explicitOld: RegistryV2Rule = {
    ...baseRule1,
    id: "npm.package.old-name.deprecated",
    purl: "pkg:npm/old-name",
  };
  const explicitNew: RegistryV2Rule = {
    ...baseRule1,
    id: "npm.package.new-name.deprecated",
    purl: "pkg:npm/new-name",
    renamedFrom: "npm.package.old-name.deprecated",
  };

  const explicitDiff = diffRules([explicitOld], [explicitNew]);
  assert.equal(explicitDiff.summary.renamed, 1);
  assert.equal(explicitDiff.summary.added, 0);
  assert.equal(explicitDiff.summary.removed, 0);
  assert.equal(explicitDiff.renamed[0]?.fromId, "npm.package.old-name.deprecated");
  assert.equal(explicitDiff.renamed[0]?.toId, "npm.package.new-name.deprecated");

  // 2. Heuristic rename (same purl, event, and ecosystem, different id)
  const heuristicOld: RegistryV2Rule = {
    ...baseRule2,
    id: "pypi.package.django.v1.end-of-support",
  };
  const heuristicNew: RegistryV2Rule = {
    ...baseRule2,
    id: "pypi.package.django.v2.end-of-support",
  };

  const heuristicDiff = diffRules([heuristicOld], [heuristicNew]);
  assert.equal(heuristicDiff.summary.renamed, 1);
  assert.equal(heuristicDiff.summary.added, 0);
  assert.equal(heuristicDiff.summary.removed, 0);
  assert.equal(heuristicDiff.renamed[0]?.fromId, "pypi.package.django.v1.end-of-support");
  assert.equal(heuristicDiff.renamed[0]?.toId, "pypi.package.django.v2.end-of-support");
});

test("diffRules filters by ecosystem when requested", () => {
  const from = [baseRule1, baseRule2];
  const to = [
    { ...baseRule1, event: "end-of-support" as const },
    { ...baseRule2, event: "end-of-life" as const },
  ];

  const npmOnly = diffRules(from, to, { ecosystem: "npm" });
  assert.equal(npmOnly.summary.totalFrom, 1);
  assert.equal(npmOnly.summary.totalTo, 1);
  assert.equal(npmOnly.summary.changed, 1);
  assert.equal(npmOnly.changed[0]?.ecosystem, "npm");

  const multiFilter = diffRules(from, to, { ecosystem: ["npm", "cargo"] });
  assert.equal(multiFilter.summary.totalFrom, 1);
});

test("formatDiffMarkdown produces release notes formatted markdown", () => {
  const modifiedRule: RegistryV2Rule = {
    ...baseRule1,
    deadline: "2020-04-11", // +60 days
  };
  const addedRule: RegistryV2Rule = {
    id: "npm.package.got.deprecated",
    ecosystem: "npm",
    purl: "pkg:npm/got",
    vers: "vers:npm/<12.0.0",
    event: "deprecated",
    title: "Got <12 deprecated",
    summary: "Got was deprecated.",
    severity: "low",
    deadline: "2023-01-01",
    sources: [{ title: "Got release", url: "https://example.com/got", accessedAt: "2023-01-01" }],
    provenance: { observedAt: "2023-01-01", reviewedAt: "2023-01-01", reviewer: "eve" },
  };

  const result = diffRules([baseRule1], [modifiedRule, addedRule]);
  const md = formatDiffMarkdown(result);

  assert.ok(md.includes("# Ebb Lifecycle Data Diff"));
  assert.ok(md.includes("### Added Rules (1)"));
  assert.ok(md.includes("#### npm"));
  assert.ok(md.includes("npm.package.got.deprecated"));
  assert.ok(md.includes("### Changed Rules (1)"));
  assert.ok(md.includes("deadline extended by 60 days"));
});

test("formatDiffText produces colored or non-colored terminal output", () => {
  const result = diffRules([baseRule1], [{ ...baseRule1, title: "Updated title" }]);
  const plainText = formatDiffText(result, { color: false });
  assert.ok(plainText.startsWith("ebb diff:"));
  assert.ok(plainText.includes("Changed (1):"));
  assert.ok(!plainText.includes("\x1b["));

  const coloredText = formatDiffText(result, { color: true });
  assert.ok(coloredText.includes("\x1b["));
});

test("diff() resolves file paths (JSON and gzip), dates, and bundled data", async () => {
  // 1. JSON file
  const bundleJsonPath = join(tempDir, "sample-bundle.json");
  const sampleBundle = {
    manifest: { version: "2099.01.01" },
    files: {
      "registry/npm.json": {
        schemaVersion: "ebb.registry.v2",
        ecosystem: "npm",
        rules: [baseRule1],
      },
    },
  };
  await writeFile(bundleJsonPath, JSON.stringify(sampleBundle));

  // 2. Gzipped JSON file
  const bundleGzPath = join(tempDir, "sample-bundle.json.gz");
  const updatedBundle = {
    manifest: { version: "2099.02.01" },
    files: {
      "registry/npm.json": {
        schemaVersion: "ebb.registry.v2",
        ecosystem: "npm",
        rules: [{ ...baseRule1, title: "Gzip title change" }],
      },
    },
  };
  await writeFile(bundleGzPath, gzipSync(Buffer.from(JSON.stringify(updatedBundle))));

  const fileDiff = await diff(bundleJsonPath, bundleGzPath);
  assert.equal(fileDiff.summary.changed, 1);
  assert.equal(fileDiff.from.version, "2099.01.01");
  assert.equal(fileDiff.to.version, "2099.02.01");

  // 3. Diff against bundled active data
  const bundledDiff = await diff("bundled", sampleBundle);
  assert.ok(bundledDiff.summary.totalFrom > 0);
  assert.equal(bundledDiff.summary.totalTo, 1);

  // 4. Diff as of date
  const pastDiff = await diff("2000-01-01", "2099-01-01");
  assert.ok(pastDiff.summary.totalFrom <= pastDiff.summary.totalTo);

  // 5. Rejects non-existent file or version
  await assert.rejects(
    () => diff("non-existent-version-12345", "bundled"),
    (err: unknown) => err instanceof DiffError && /was not found in cache/.test(err.message),
  );
});
