import assert from "node:assert/strict";
import { test } from "node:test";
import { check, resolveCandidateRules } from "../../src/check.js";
import { PurlError } from "../../src/purl.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

const nodejsIds = (purl: string): string[] =>
  resolveCandidateRules(purl)
    .map((rule) => rule.id)
    .sort((left, right) => left.localeCompare(right));

test("known packages resolve to their candidate rules", () => {
  const ids = nodejsIds("pkg:generic/nodejs");
  assert.deepEqual(ids, [
    "nodejs.runtime.eol-18",
    "nodejs.runtime.eol-19",
    "nodejs.runtime.eol-20",
    "nodejs.runtime.eol-21",
    "nodejs.runtime.eol-22",
    "nodejs.runtime.eol-23",
    "nodejs.runtime.eol-25",
    "nodejs.runtime.legacy",
  ]);
  assert.equal(resolveCandidateRules("pkg:npm/left-pad").length, 1);
  assert.equal(resolveCandidateRules("pkg:npm/left-pad")[0]?.id, "npm.package.left-pad.deprecated");
});

test("unknown packages resolve to no rules", () => {
  assert.deepEqual(resolveCandidateRules("pkg:npm/this-package-is-not-in-ebb"), []);
  assert.deepEqual(resolveCandidateRules("pkg:generic/no-such-product"), []);
});

test("normalised spellings of the same package share one candidate set", () => {
  assert.deepEqual(nodejsIds("pkg:generic/nodejs@20.18.0"), nodejsIds("pkg:generic/nodejs"));
  assert.deepEqual(
    resolveCandidateRules("pkg:npm/Left-Pad").map((rule) => rule.id),
    resolveCandidateRules("pkg:npm/left-pad").map((rule) => rule.id),
  );
});

test('"pkg:npm/left-pad?Arch=x64" resolves to the same rules as "pkg:npm/left-pad"', () => {
  assert.deepEqual(
    resolveCandidateRules("pkg:npm/left-pad?Arch=x64").map((rule) => rule.id),
    resolveCandidateRules("pkg:npm/left-pad").map((rule) => rule.id),
  );
});

test("check throws for an invalid purl", () => {
  assert.throws(() => check("pkg:", "1.0.0", AS_OF), PurlError);
});

test("check keeps candidate resolution and still returns the original version", () => {
  const result = check("pkg:generic/nodejs", "24.0.0", AS_OF);
  assert.equal(result.version, "24.0.0");
  assert.equal(result.status, "ok");
  assert.deepEqual(result.matches, []);
});
