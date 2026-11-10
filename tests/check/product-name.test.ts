import assert from "node:assert/strict";
import { test } from "node:test";

import { check, CheckError, resolveCandidateRules } from "../../src/check.js";

const ruleIds = (purlOrName: string): string[] =>
  resolveCandidateRules(purlOrName)
    .map((rule) => rule.id)
    .sort((left, right) => left.localeCompare(right));

test('check("node", "18.0.0") matches pkg:generic/nodejs', () => {
  const byName = check("node", "18.0.0");
  const byPurl = check("pkg:generic/nodejs", "18.0.0");
  assert.equal(byName.status, byPurl.status);
  assert.deepEqual(
    byName.matches.map((match) => match.ruleId),
    byPurl.matches.map((match) => match.ruleId),
  );
  assert.deepEqual(ruleIds("node"), ruleIds("pkg:generic/nodejs"));
});

test('check("nodejs", "18.0.0") matches pkg:generic/nodejs', () => {
  const byName = check("nodejs", "18.0.0");
  const byPurl = check("pkg:generic/nodejs", "18.0.0");
  assert.equal(byName.status, byPurl.status);
  assert.deepEqual(
    byName.matches.map((match) => match.ruleId),
    byPurl.matches.map((match) => match.ruleId),
  );
});

test('"python" resolves to pkg:generic/python', () => {
  assert.deepEqual(ruleIds("python"), ruleIds("pkg:generic/python"));
  assert.equal(check("python", "3.8.0").status, check("pkg:generic/python", "3.8.0").status);
});

test('"left-pad" and "Left Pad" resolve like pkg:npm/left-pad', () => {
  assert.deepEqual(ruleIds("left-pad"), ruleIds("pkg:npm/left-pad"));
  assert.deepEqual(ruleIds("Left Pad"), ruleIds("pkg:npm/left-pad"));
  assert.equal(check("left-pad", "1.0.0").status, check("pkg:npm/left-pad", "1.0.0").status);
  assert.equal(check("Left Pad", "1.0.0").status, check("pkg:npm/left-pad", "1.0.0").status);
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

test("a name that stays tied after aliasing throws and lists the matches", () => {
  assert.throws(
    () => check("debian", "11.0.0"),
    (error: unknown) => {
      assert.ok(error instanceof CheckError);
      assert.match(error.message, /Ambiguous product name "debian"/);
      assert.match(error.message, /pkg:docker\/library\/debian/);
      assert.match(error.message, /pkg:generic\/debian/);
      return true;
    },
  );
});
