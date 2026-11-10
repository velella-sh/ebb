import assert from "node:assert/strict";
import { test } from "node:test";

import { check, CheckError, resolveCandidateRules } from "../../src/check.js";

test("a known product name resolves like its purl", () => {
  const byName = check("left-pad", "1.0.0");
  const byPurl = check("pkg:npm/left-pad", "1.0.0");
  assert.equal(byName.status, byPurl.status);
  assert.deepEqual(
    byName.matches.map((match) => match.ruleId),
    byPurl.matches.map((match) => match.ruleId),
  );
  assert.deepEqual(
    resolveCandidateRules("left-pad").map((rule) => rule.id),
    resolveCandidateRules("pkg:npm/left-pad").map((rule) => rule.id),
  );
});

test("an unknown product name throws", () => {
  assert.throws(
    () => check("no-such-product", "1.0.0"),
    (error: unknown) => {
      assert.ok(error instanceof CheckError);
      assert.match(error.message, /Unknown product "no-such-product"/);
      return true;
    },
  );
});

test("an ambiguous product name throws and lists the matches", () => {
  assert.throws(
    () => check("nodejs", "18.0.0"),
    (error: unknown) => {
      assert.ok(error instanceof CheckError);
      assert.match(error.message, /Ambiguous product name "nodejs"/);
      assert.match(error.message, /pkg:generic\/nodejs/);
      assert.match(error.message, /pkg:generic\/aws-lambda-runtime\/nodejs/);
      return true;
    },
  );
});
