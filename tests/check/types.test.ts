import assert from "node:assert/strict";
import { test } from "node:test";
import { check, type CheckMatch, type CheckResult } from "../../src/check.js";
import type { EvidenceSource } from "../../src/domain.js";
import { RESULT_SCHEMA_VERSION } from "../../src/result.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

test("check returns ok with no matches and the original version", () => {
  // Node.js 24 has no bundled rule yet, so this stays the empty-result shape.
  const result: CheckResult = check("pkg:generic/nodejs", "24.0.0", AS_OF);
  assert.deepEqual(result, {
    schemaVersion: RESULT_SCHEMA_VERSION,
    status: "ok",
    matches: [],
    version: "24.0.0",
    asOf: AS_OF,
  });
});

test("CheckResult accepts a filled match with replacement null", () => {
  const source: EvidenceSource = {
    title: "Node.js release schedule",
    url: "https://nodejs.org/en/about/previous-releases",
  };
  const match: CheckMatch = {
    ruleId: "nodejs.runtime.eol-18",
    event: "end-of-life",
    date: "2025-04-30",
    daysLeft: null,
    replacement: null,
    sources: [source],
    reviewedAt: "2026-10-17",
  };
  const result: CheckResult = {
    schemaVersion: 1,
    status: "end-of-life",
    matches: [match],
    version: "18.20.0",
    asOf: AS_OF,
  };
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, "end-of-life");
  assert.equal(result.version, "18.20.0");
  assert.equal(result.asOf, AS_OF);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.ruleId, "nodejs.runtime.eol-18");
  assert.equal(result.matches[0]?.event, "end-of-life");
  assert.equal(result.matches[0]?.date, "2025-04-30");
  assert.equal(result.matches[0]?.daysLeft, null);
  assert.equal(result.matches[0]?.replacement, null);
  assert.deepEqual(result.matches[0]?.sources, [source]);
  assert.equal(result.matches[0]?.reviewedAt, "2026-10-17");
});
