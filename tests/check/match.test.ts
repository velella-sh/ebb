import assert from "node:assert/strict";
import { test } from "node:test";

import { check } from "../../src/check.js";

const nodejs = "pkg:generic/nodejs";
/** `nodejs.runtime.eol-18`: `vers:semver/>=18.0.0|<19.0.0`. */
const eol18 = "nodejs.runtime.eol-18";

test("a version inside a range keeps the matching rule", () => {
  const result = check(nodejs, "18.20.0");
  assert.equal(result.status, "end-of-life");
  assert.equal(result.version, "18.20.0");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.ruleId, eol18);
  assert.equal(result.matches[0]?.event, "end-of-life");
  assert.equal(result.matches[0]?.date, "2025-04-30");
  assert.equal(result.matches[0]?.replacement, "Node.js 22 LTS or later");
  assert.ok((result.matches[0]?.sources.length ?? 0) > 0);
});

test("a version outside a range is not kept", () => {
  const below = check(nodejs, "17.9.1");
  assert.equal(
    below.matches.some((match) => match.ruleId === eol18),
    false,
  );

  const above = check(nodejs, "19.0.0");
  assert.equal(
    above.matches.some((match) => match.ruleId === eol18),
    false,
  );
  assert.equal(above.matches[0]?.ruleId, "nodejs.runtime.eol-19");
});

test("the inclusive lower edge of a range matches", () => {
  const result = check(nodejs, "18.0.0");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.ruleId, eol18);
  assert.equal(result.status, "end-of-life");
});

test("the exclusive upper edge of a range does not match", () => {
  const result = check(nodejs, "19.0.0");
  assert.equal(
    result.matches.some((match) => match.ruleId === eol18),
    false,
  );
});

test("a deprecated package matches every version in its range", () => {
  const result = check("pkg:npm/left-pad", "1.3.0");
  assert.equal(result.status, "deprecated");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.ruleId, "npm.package.left-pad.deprecated");
  assert.equal(result.matches[0]?.event, "deprecated");
  assert.equal(result.matches[0]?.replacement, "String.prototype.padStart()");
  assert.equal(result.matches[0]?.date, null);
});

test("scheduled-end-of-life maps to scheduled on the match and status", () => {
  const result = check(nodejs, "22.11.0");
  assert.equal(result.status, "scheduled");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.ruleId, "nodejs.runtime.eol-22");
  assert.equal(result.matches[0]?.event, "scheduled");
  assert.equal(result.matches[0]?.date, "2027-04-30");
});
