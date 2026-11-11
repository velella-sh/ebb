import assert from "node:assert/strict";
import { test } from "node:test";

import { VersError } from "../../src/vers/errors.js";
import { compareStrictSemver, isValidStrictSemver, semverScheme } from "../../src/vers/semver.js";

test("semverScheme follows the full SemVer 2.0.0 precedence example", () => {
  // Ordered ascending per https://semver.org/#spec-item-11.
  const ordered = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "2.0.0",
    "2.1.0",
    "2.1.1",
  ];
  const reversed = [...ordered].reverse();
  assert.deepEqual(
    reversed.sort((left, right) => semverScheme.compare(left, right)),
    ordered,
  );
  assert.deepEqual([...ordered].reverse().sort(compareStrictSemver), ordered);
});

test("semverScheme compares numeric vs alphanumeric prerelease identifiers per SemVer 2.0.0", () => {
  assert.equal(semverScheme.compare("1.0.0-1", "1.0.0-alpha"), -1);
  assert.equal(semverScheme.compare("1.0.0-9", "1.0.0-10"), -1);
  assert.equal(semverScheme.compare("1.0.0-alpha", "1.0.0-alpha.1"), -1);
  assert.equal(semverScheme.compare("1.0.0-9", "1.0.0--"), -1);
  assert.equal(semverScheme.compare("1.0.0-9007199254740991", "1.0.0-9007199254740992"), -1);
  assert.equal(semverScheme.compare("1.0.0-9007199254740991", "1.0.0--"), -1);
  assert.equal(semverScheme.compare("9007199254740991.0.0", "1.0.0"), 1);
});

test("semverScheme ignores build metadata and handles loose and Go/Composer short forms", () => {
  assert.equal(semverScheme.compare("1.0.0+20130313144700", "1.0.0+exp.sha.5114f85"), 0);
  assert.equal(semverScheme.compare("v2.0.0+incompatible", "2.0.0"), 0);
  assert.equal(semverScheme.compare("=v1.2.3", "1.2.3"), 0);
  assert.equal(semverScheme.compare("01.02.03", "1.2.3"), 0);
  assert.equal(semverScheme.compare("1.2.3alpha1", "1.2.3-alpha1"), 0);
  assert.equal(semverScheme.compare("1.2.3-01", "1.2.3-1"), 0);
  assert.equal(semverScheme.compare("1", "1.0.0"), 0);
  assert.equal(semverScheme.compare("1.2", "1.2.0"), 0);
  assert.equal(semverScheme.compare("v1.2-rc.1", "1.2.0-rc.1"), 0);
  assert.equal(semverScheme.compare("1.2.3-", "1.2.3--"), 0);
});

test("strict SemVer validation and comparison reject loose-only and malformed versions", () => {
  for (const valid of ["0.0.0", "1.2.3", "v1.2.3", " 1.2.3 ", "1.0.0-alpha-1.0+build.1", "9007199254740991.0.0"]) {
    assert.equal(isValidStrictSemver(valid), true, `expected strict valid: ${valid}`);
  }
  for (const invalid of [
    "",
    "1",
    "1.2",
    "V1.2.3",
    "=1.2.3",
    "vv1.2.3",
    "01.2.3",
    "1.2.3-01",
    "1.2.3alpha1",
    "1.2.3-",
    "1.2.3+",
    "1.2.3-.",
    "1.2.3+.",
    "1.2.3-a..b",
    "1.2.3+foo_bar",
    "9007199254740992.0.0",
    "1.2.3.4",
    `${"1".repeat(257)}.0.0`,
  ]) {
    assert.equal(isValidStrictSemver(invalid), false, `expected strict invalid: ${invalid}`);
    assert.throws(() => compareStrictSemver(invalid, "1.0.0"), VersError);
  }

  for (const invalidLoose of ["", "V1.2.3", "1.2.3+", "1.2.3-.", "1.2.3-a..b", "1.2.3.4", "9007199254740992.0.0"]) {
    assert.throws(() => semverScheme.compare(invalidLoose, "1.0.0"), VersError);
  }
});
