import assert from "node:assert/strict";
import { test } from "node:test";

import { check, normalizeVersionInput } from "../../src/check.js";

test("normalizeVersionInput trims, drops a leading v, and strips build metadata", () => {
  assert.equal(normalizeVersionInput(" v1.2.3+build5 "), "1.2.3");
  assert.equal(normalizeVersionInput("1.2.3"), "1.2.3");
  assert.equal(normalizeVersionInput("V1.2.3-rc.1+meta"), "1.2.3-rc.1");
});

test('" v1.2.3+build5 " and 1.2.3 give the same result', () => {
  const spaced = check("pkg:generic/nodejs", " v1.2.3+build5 ");
  const plain = check("pkg:generic/nodejs", "1.2.3");

  assert.equal(normalizeVersionInput(" v1.2.3+build5 "), normalizeVersionInput("1.2.3"));
  assert.equal(spaced.status, plain.status);
  assert.deepEqual(spaced.matches, plain.matches);
  assert.equal(spaced.version, " v1.2.3+build5 ");
  assert.equal(plain.version, "1.2.3");
});
