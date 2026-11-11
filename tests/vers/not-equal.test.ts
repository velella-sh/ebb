import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatVers,
  normalizeVers,
  parseVers,
  parseVersLenient,
  versContains,
  VersError,
} from "../../src/vers/index.js";

test("standalone and multiple != constraints exclude listed versions and include others", () => {
  assert.equal(versContains("vers:pypi/!=5", "4"), true);
  assert.equal(versContains("vers:pypi/!=5", "5"), false);
  assert.equal(versContains("vers:pypi/!=5", "6"), true);

  assert.equal(versContains("vers:npm/!=1.0.0|!=2.0.0", "0.9.0"), true);
  assert.equal(versContains("vers:npm/!=1.0.0|!=2.0.0", "1.0.0"), false);
  assert.equal(versContains("vers:npm/!=1.0.0|!=2.0.0", "1.5.0"), true);
  assert.equal(versContains("vers:npm/!=1.0.0|!=2.0.0", "2.0.0"), false);
  assert.equal(versContains("vers:npm/!=1.0.0|!=2.0.0", "3.0.0"), true);
});

test("!= interacts correctly with equality and bound constraints, including equivalent spellings", () => {
  // With explicit equality, only the equal version matches; unrelated versions do not.
  assert.equal(versContains("vers:npm/1.0.0|!=2.0.0", "1.0.0"), true);
  assert.equal(versContains("vers:npm/1.0.0|!=2.0.0", "2.0.0"), false);
  assert.equal(versContains("vers:npm/1.0.0|!=2.0.0", "3.0.0"), false);

  // Inside bounded or split intervals.
  assert.equal(versContains("vers:npm/>=1.0.0|!=1.5.0|!=1.8.0|<2.0.0", "1.5.0"), false);
  assert.equal(versContains("vers:npm/>=1.0.0|!=1.5.0|!=1.8.0|<2.0.0", "1.6.0"), true);
  assert.equal(versContains("vers:npm/<1.0.0|!=2.0.0|>1.5.0", "2.0.0"), false);
  assert.equal(versContains("vers:npm/<1.0.0|!=2.0.0|>1.5.0", "2.1.0"), true);

  // Exclusions match by scheme version equality, not just literal string equality.
  assert.equal(versContains("vers:intdot/!=1.2", "01.2.0"), false);
  assert.equal(versContains("vers:pypi/!=1.0a1", "1.0alpha1"), false);
  assert.equal(versContains("vers:nuget/!=1.0.0-BETA", "1.0.0-beta"), false);
});

test("!= parses, normalises, formats canonically, and rejects invalid uses", () => {
  const parsed = parseVers("vers:npm/!=1.0.0|>=1.5.0|<2.0.0");
  assert.deepEqual(parsed.constraints, [
    { comparator: "!=", version: "1.0.0" },
    { comparator: ">=", version: "1.5.0" },
    { comparator: "<", version: "2.0.0" },
  ]);
  assert.equal(formatVers(parsed), "vers:npm/!=1.0.0|>=1.5.0|<2.0.0");
  assert.equal(normalizeVers("vers:npm/ >=1.5.0 | != 1.0.0 "), "vers:npm/!=1.0.0|>=1.5.0");

  assert.throws(() => parseVers("vers:npm/!="), VersError);
  assert.throws(() => parseVersLenient("vers:npm/1.0.0|!=1.0.0"), /appears more than once/);
  assert.throws(() => parseVersLenient("vers:npm/>=1.0.0|!=1.0.0|<2.0.0"), /appears more than once/);
});
