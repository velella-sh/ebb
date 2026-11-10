import assert from "node:assert/strict";
import { test } from "node:test";

import { check, type CheckMatch, type CheckResult } from "../../src/check.js";
import type { EvidenceSource } from "../../src/domain.js";

test("check returns ok with no matches and the original version", () => {
  const result: CheckResult = check("pkg:generic/nodejs", "20.18.0");
  assert.deepEqual(result, { status: "ok", matches: [], version: "20.18.0" });
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
    replacement: null,
    sources: [source],
  };
  const result: CheckResult = {
    status: "end-of-life",
    matches: [match],
    version: "18.20.0",
  };
  assert.equal(result.status, "end-of-life");
  assert.equal(result.version, "18.20.0");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.ruleId, "nodejs.runtime.eol-18");
  assert.equal(result.matches[0]?.event, "end-of-life");
  assert.equal(result.matches[0]?.date, "2025-04-30");
  assert.equal(result.matches[0]?.replacement, null);
  assert.deepEqual(result.matches[0]?.sources, [source]);
});
