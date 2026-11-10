import assert from "node:assert/strict";
import { test } from "node:test";

import { check } from "../../src/check.js";

test("an unknown package is ok with an empty match list", () => {
  const result = check("pkg:npm/this-package-is-not-in-ebb", "1.2.3");
  assert.deepEqual(result, {
    status: "ok",
    matches: [],
    version: "1.2.3",
  });
});

test("a known package with a safe version is ok with an empty match list", () => {
  // Node.js 24 has no bundled rule yet, so every version stays unmatched.
  const result = check("pkg:generic/nodejs", "24.0.0");
  assert.deepEqual(result, {
    status: "ok",
    matches: [],
    version: "24.0.0",
  });
});
