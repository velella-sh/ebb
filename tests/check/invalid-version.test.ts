import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../../src/check.js";
import { VersError } from "../../src/vers.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

const nodejs = "pkg:generic/nodejs";

test("an empty version throws instead of reporting ok", () => {
  assert.throws(
    () => check(nodejs, "", AS_OF),
    (error: unknown) => {
      assert.ok(error instanceof VersError);
      assert.match(error.message, /Invalid version/);
      return true;
    },
  );
  assert.throws(
    () => check(nodejs, "   ", AS_OF),
    (error: unknown) => {
      assert.ok(error instanceof VersError);
      return true;
    },
  );
});

test("a non-version string throws instead of reporting ok", () => {
  assert.throws(
    () => check(nodejs, "banana", AS_OF),
    (error: unknown) => {
      assert.ok(error instanceof VersError);
      assert.match(error.message, /banana/);
      return true;
    },
  );
});

test("a leading v still matches", () => {
  const result = check(nodejs, "v18.20.0", AS_OF);
  assert.equal(result.status, "end-of-life");
  assert.equal(result.version, "v18.20.0");
  assert.equal(result.matches[0]?.ruleId, "nodejs.runtime.eol-18");
});

test("build metadata still matches", () => {
  const result = check(nodejs, "18.20.0+build", AS_OF);
  assert.equal(result.status, "end-of-life");
  assert.equal(result.version, "18.20.0+build");
  assert.equal(result.matches[0]?.ruleId, "nodejs.runtime.eol-18");
});
