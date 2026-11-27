import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readGrypeReport } from "../../src/bridge/grype.js";
import { formatBridgeMarkdown, mergeBridgeReport } from "../../src/bridge/merge.js";
import { readTrivyReport } from "../../src/bridge/trivy.js";

const TRIVY_DIR = join(process.cwd(), "tests", "fixtures", "trivy");
const GRYPE_DIR = join(process.cwd(), "tests", "fixtures", "grype");

test("mergeBridgeReport generates combined report with lifecycle section and counts for Trivy", () => {
  const content = readFileSync(join(TRIVY_DIR, "image-report.json"), "utf8");
  const input = readTrivyReport(content);
  const combined = mergeBridgeReport(input);

  assert.equal(combined.scanner, "trivy");
  assert.equal(combined.scannerVersion, "0.60.0");
  assert.equal(combined.target, "alpine:3.14");

  // Lifecycle section points back to scanner package ids
  const osFinding = combined.lifecycle.find((f) => f.packageId === "os:alpine");
  assert.ok(osFinding);
  assert.equal(osFinding.status, "end-of-life");
  assert.equal(osFinding.event, "end-of-life");
  assert.equal(osFinding.ruleId, "container.host-alpine.eol-3.20-and-older");
  assert.equal(osFinding.deadline, "2026-04-01");
  assert.equal(osFinding.replacement, "Alpine Linux 3.21 or later");

  // Counts
  assert.equal(combined.counts.checked, 4);
  assert.equal(combined.counts.endOfLife, 1);
  assert.equal(combined.counts.deprecated, 0);
  assert.equal(combined.counts.unknown, 3);
  assert.equal(combined.counts.withoutPurl, 0);

  // Original findings preserved
  assert.ok(combined.rawReport.Results);

  // Markdown formatting
  const markdown = formatBridgeMarkdown(combined);
  assert.match(markdown, /### Ebb Lifecycle Bridge Summary \(trivy\)/);
  assert.match(markdown, /\|\s+\*\*Total Checked\*\*\s+\|\s+4\s+\|/);
  assert.match(markdown, /\|\s+❌\s+\*\*end-of-life\*\*\s+\|\s+1\s+\|/);
  assert.match(
    markdown,
    /\|\s+alpine:3.14\s+\|\s+os:alpine\s+\|\s+pkg:generic\/alpine@3.14.0\s+\|\s+❌ end-of-life\s+\|\s+2026-04-01\s+\|\s+Alpine Linux 3.21 or later\s+\|/,
  );
});

test("mergeBridgeReport generates combined report for filesystem Trivy scan", () => {
  const content = readFileSync(join(TRIVY_DIR, "fs-report.json"), "utf8");
  const input = readTrivyReport(content);
  const combined = mergeBridgeReport(input);

  assert.equal(combined.counts.checked, 3);
  assert.equal(combined.counts.deprecated, 1); // request
  assert.equal(combined.counts.endOfLife, 1); // node-sass
  assert.equal(combined.counts.unknown, 1); // express

  const reqFinding = combined.lifecycle.find((f) => f.packageId === "request@2.88.2");
  assert.ok(reqFinding);
  assert.equal(reqFinding.status, "deprecated");
  assert.equal(reqFinding.event, "deprecated");
  assert.equal(reqFinding.ruleId, "npm.package.request.deprecated");
});

test("mergeBridgeReport generates combined report with lifecycle section and counts for Grype", () => {
  const content = readFileSync(join(GRYPE_DIR, "image-report.json"), "utf8");
  const input = readGrypeReport(content);
  const combined = mergeBridgeReport(input);

  assert.equal(combined.scanner, "grype");
  assert.equal(combined.scannerVersion, "0.87.0");

  // OS Alpine 3.14 is end-of-life
  assert.equal(combined.counts.checked, 3);
  assert.equal(combined.counts.endOfLife, 1);
  assert.equal(combined.counts.unknown, 2);

  const osFinding = combined.lifecycle.find((f) => f.packageId === "os:alpine");
  assert.ok(osFinding);
  assert.equal(osFinding.status, "end-of-life");

  const markdown = formatBridgeMarkdown(combined);
  assert.match(markdown, /### Ebb Lifecycle Bridge Summary \(grype\)/);
  assert.match(markdown, /> ⚠️ \*\*Warning\*\*: Grype reports list only vulnerable artifacts/);
  assert.match(
    markdown,
    /\|\s+alpine:3.14\s+\|\s+os:alpine\s+\|\s+pkg:generic\/alpine@3.14.0\s+\|\s+❌ end-of-life\s+/,
  );
});
