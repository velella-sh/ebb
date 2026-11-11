import assert from "node:assert/strict";
import { test } from "node:test";

import { hasVersionScheme, parseVers, SUPPORTED_SCHEMES as VERS_SCHEMES, versionScheme } from "../../src/vers.js";
import { SUPPORTED_SCHEMES } from "../../src/vers/schemes.js";

test("SUPPORTED_SCHEMES lists all built-in schemes and loads directly from src/vers.ts", () => {
  assert.equal(VERS_SCHEMES, SUPPORTED_SCHEMES);
  assert.deepEqual(Object.keys(SUPPORTED_SCHEMES).sort(), [
    "cargo",
    "composer",
    "gem",
    "golang",
    "intdot",
    "maven",
    "npm",
    "nuget",
    "pypi",
    "semver",
  ]);

  for (const [name, scheme] of Object.entries(SUPPORTED_SCHEMES)) {
    assert.equal(hasVersionScheme(name), true);
    assert.equal(versionScheme(name), scheme);
    assert.ok(scheme.names.includes(name), `${name} must appear in its comparator's names`);
    for (const declared of scheme.names) {
      assert.equal(SUPPORTED_SCHEMES[declared], scheme, `${declared} must appear in SUPPORTED_SCHEMES`);
    }
    assert.equal(parseVers(`vers:${name}/*`).scheme, name);
  }
});
