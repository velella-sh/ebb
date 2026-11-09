import assert from "node:assert/strict";
import { test } from "node:test";

import { CHECK_SCHEMA_VERSION, check, type CheckMatch, type CheckResult, type CheckStatus } from "../../src/check.js";
import type { EvidenceSource, Severity } from "../../src/domain.js";
import type { LifecycleEvent } from "../../src/registry.js";

test("check accepts a purl and version and returns the v1 result shape", async () => {
  const result: CheckResult = await check("pkg:generic/nodejs", "20.18.0");
  assert.equal(result.schemaVersion, CHECK_SCHEMA_VERSION);
  assert.equal(CHECK_SCHEMA_VERSION, "ebb.check.v1");
  assert.deepEqual(result.query, { purl: "pkg:generic/nodejs", version: "20.18.0" });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.matches, []);
  assert.equal("deadline" in result, false);
  assert.equal("replacement" in result, false);
});

test("CheckResult can carry a primary match answer without changing the top-level fields", () => {
  const source: EvidenceSource = {
    title: "Node.js release schedule",
    url: "https://nodejs.org/en/about/previous-releases",
  };
  const match: CheckMatch = {
    ruleId: "nodejs.runtime.eol-18",
    event: "end-of-life",
    severity: "high",
    title: "Node.js 18 is end of life",
    deadline: "2025-04-30",
    replacement: "Node.js 20 or 22",
    sources: [source],
  };
  const status: CheckStatus = match.event;
  const severity: Severity = match.severity;
  const event: LifecycleEvent = match.event;
  const result: CheckResult = {
    schemaVersion: CHECK_SCHEMA_VERSION,
    query: { purl: "pkg:generic/nodejs", version: "18.20.4" },
    status,
    deadline: "2025-04-30",
    replacement: "Node.js 20 or 22",
    sources: match.sources,
    matches: [match],
  };
  assert.equal(result.status, "end-of-life");
  assert.equal(result.deadline, "2025-04-30");
  assert.equal(result.replacement, "Node.js 20 or 22");
  assert.equal(result.sources[0]?.title, source.title);
  assert.equal(severity, "high");
  assert.equal(event, "end-of-life");
  assert.equal(result.matches[0]?.ruleId, "nodejs.runtime.eol-18");
});
