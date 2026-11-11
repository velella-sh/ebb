import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatVers,
  normalizeVers,
  parseVers,
  parseVersLenient,
  validateVersVersions,
  versContains,
  VersError,
} from "../../src/vers/index.js";

test("wildcard * matches any version, formats cleanly, and validates", () => {
  assert.deepEqual(parseVers("vers:npm/*"), { scheme: "npm", constraints: [], all: true });
  assert.deepEqual(parseVersLenient("vers:NPM/ * "), { scheme: "npm", constraints: [], all: true });
  assert.equal(normalizeVers("vers:npm/ * "), "vers:npm/*");
  assert.equal(formatVers({ scheme: "npm", constraints: [], all: true }), "vers:npm/*");
  assert.doesNotThrow(() => validateVersVersions("vers:npm/*"));
  assert.equal(versContains("vers:npm/*", "1.0.0"), true);
  assert.equal(versContains("vers:npm/*", "not-a-semver"), true);
});

test("rejects misplaced * combined with a version or other constraints", () => {
  for (const invalid of [
    "vers:npm/*|1.0.0",
    "vers:npm/1.0.0|*",
    "vers:npm/*1.0.0",
    "vers:npm/1.0*",
    "vers:npm/>=*",
    "vers:npm/!=*",
    "vers:npm/=*",
  ]) {
    assert.throws(() => parseVers(invalid), VersError, invalid);
    assert.throws(() => parseVersLenient(invalid), VersError, invalid);
  }
  assert.throws(
    () => formatVers({ scheme: "npm", constraints: [{ comparator: "=", version: "1.0.0" }], all: true }),
    /"\*" must be the only constraint/,
  );
  // Percent-encoded %2A inside a version is a literal asterisk, not the wildcard comparator.
  assert.deepEqual(parseVers("vers:intdot/1%2A2"), {
    scheme: "intdot",
    constraints: [{ comparator: "=", version: "1*2" }],
    all: false,
  });
});

test("rejects empty ranges in parsing, formatting, and containment", () => {
  for (const empty of ["", "vers:", "vers:npm", "vers:npm/", "vers:npm/   ", "vers:npm/|1.0", "vers:npm/1.0|"]) {
    assert.throws(() => parseVers(empty), VersError, empty);
    assert.throws(() => parseVersLenient(empty), VersError, empty);
  }
  assert.throws(() => formatVers({ scheme: "npm", constraints: [], all: false }), /constraints must not be empty/);
  assert.throws(
    () => versContains({ scheme: "npm", constraints: [], all: false }, "1.0.0"),
    /constraints must not be empty/,
  );
});
