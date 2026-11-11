import assert from "node:assert/strict";
import { test } from "node:test";

import { EbbError } from "../../src/errors.js";
import {
  formatVers,
  parseVers,
  parseVersLenient,
  validateVersVersions,
  versContains,
  VersError,
  versionScheme,
} from "../../src/vers/index.js";

/**
 * Every invalid VERS form checked by the spec and Ebb's validator, each paired
 * with the specific message naming the problem and carrying `EbbError.code`.
 */
const INVALID_CANONICAL_CASES: ReadonlyArray<{ value: string; message: string }> = [
  { value: "", message: 'VERS must start with "vers:": ' },
  { value: "npm/1.0.0", message: 'VERS must start with "vers:": npm/1.0.0' },
  { value: "VERS:npm/1.0.0", message: 'VERS must start with "vers:": VERS:npm/1.0.0' },
  { value: "vers:", message: "VERS is missing a scheme: vers:" },
  { value: "vers:/1.0.0", message: "VERS is missing a scheme: vers:/1.0.0" },
  { value: "vers:1bad", message: 'Invalid VERS scheme "1bad".' },
  { value: "vers:1bad/1.0", message: 'Invalid VERS scheme "1bad".' },
  { value: "vers:npm", message: "VERS is missing constraints: vers:npm" },
  { value: "vers:NPM/1.0.0", message: 'non-canonical VERS: scheme "NPM" must be lowercase' },
  { value: "vers:nonexistent/1.0.0", message: 'Unsupported VERS scheme "nonexistent".' },
  { value: "vers:npm/", message: "non-canonical VERS: constraints must not be empty" },
  { value: "vers:npm/>=1.0.0| <2.0.0", message: "non-canonical VERS: whitespace is not permitted" },
  { value: "vers:npm/1 2", message: "non-canonical VERS: whitespace is not permitted" },
  { value: "vers:npm/1%092", message: "non-canonical VERS: whitespace is not permitted" },
  { value: "vers:npm/|1.0.0", message: "non-canonical VERS: leading pipe is not permitted" },
  { value: "vers:npm/1.0.0|", message: "non-canonical VERS: trailing pipe is not permitted" },
  { value: "vers:npm/1.0.0||2.0.0", message: "non-canonical VERS: consecutive pipes are not permitted" },
  { value: "vers:npm/=1.0.0", message: "non-canonical VERS: explicit equality comparator is not permitted" },
  { value: "vers:npm/==1.0.0", message: "non-canonical VERS: explicit equality comparator is not permitted" },
  { value: "vers:npm/>=", message: 'Missing version in constraint ">=".' },
  { value: "vers:npm/!=", message: 'Missing version in constraint "!=".' },
  { value: "vers:npm/1.0%2G0", message: 'non-canonical VERS: invalid percent-encoding in version "1.0%2G0"' },
  {
    value: "vers:npm/1.0%2f0",
    message: 'non-canonical VERS: percent-encoding in version is not canonical "1.0%2f0"',
  },
  { value: "vers:npm/1.0!beta", message: 'non-canonical VERS: unencoded reserved character in version "1.0!beta"' },
  { value: "vers:npm/*|1.0.0", message: '"*" must be the only constraint: vers:npm/*|1.0.0' },
  {
    value: "vers:npm/*1.0.0",
    message: 'non-canonical VERS: unencoded reserved character in version "*1.0.0"',
  },
  { value: "vers:npm/>=2.0.0|<1.0.0", message: "non-canonical VERS: constraints are not sorted by version" },
  {
    value: "vers:npm/>=1.0.0|<1.0.0",
    message: 'Invalid VERS: version "1.0.0" appears more than once: vers:npm/>=1.0.0|<1.0.0',
  },
  {
    value: "vers:npm/1.0.0|<2.0.0",
    message: "Invalid VERS: an equality constraint cannot be followed by an upper bound: vers:npm/1.0.0|<2.0.0",
  },
  {
    value: "vers:npm/>=1.0.0|>2.0.0",
    message: "Invalid VERS: bounds must alternate between lower and upper: vers:npm/>=1.0.0|>2.0.0",
  },
  {
    value: "vers:npm/<1.0.0|<=2.0.0",
    message: "Invalid VERS: bounds must alternate between lower and upper: vers:npm/<1.0.0|<=2.0.0",
  },
];

function assertVersError(fn: () => unknown, expected: string | RegExp): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof VersError);
    assert.ok(error instanceof EbbError);
    assert.equal(error.code, "invalid-version");
    if (typeof expected === "string") assert.equal(error.message, expected);
    else assert.match(error.message, expected);
    return true;
  });
}

test("each invalid VERS range throws VersError (extending EbbError) naming the problem", async (t) => {
  for (const { value, message } of INVALID_CANONICAL_CASES) {
    await t.test(value || "<empty>", () => assertVersError(() => parseVers(value), message));
  }
});

test("lenient parsing, formatting, validation, and scheme lookup also throw typed VersError", () => {
  assertVersError(() => parseVersLenient("vers:npm/   "), "non-canonical VERS: constraints must not be empty");
  assertVersError(() => parseVersLenient("vers:npm/*1.0.0"), '"*" must be the only constraint: *1.0.0');
  assertVersError(() => parseVersLenient("vers:npm/="), 'Missing version in constraint "=".');
  assertVersError(() => parseVersLenient("vers:npm/1.0|<2.0"), /equality constraint cannot be followed/);
  assertVersError(() => formatVers({ scheme: "", constraints: [], all: true }), "VERS scheme is required.");
  assertVersError(() => formatVers({ scheme: "1bad", constraints: [], all: true }), 'Invalid VERS scheme "1bad".');
  assertVersError(
    () => formatVers({ scheme: "npm", constraints: [], all: false }),
    "non-canonical VERS: constraints must not be empty",
  );
  assertVersError(
    () => formatVers({ scheme: "npm", constraints: [{ comparator: "=", version: "1.0.0" }], all: true }),
    '"*" must be the only constraint',
  );
  assertVersError(() => validateVersVersions("vers:intdot/>=abc"), 'Invalid intdot version "abc".');
  assertVersError(() => versionScheme("nonexistent"), 'Unsupported VERS scheme "nonexistent".');
  assertVersError(
    () => versContains({ scheme: "npm", constraints: [], all: false }, "1.0.0"),
    "non-canonical VERS: constraints must not be empty",
  );
  assertVersError(() => versContains("vers:npm/<2.0.0", "not-a-semver"), 'Invalid semver version "not-a-semver".');
});
