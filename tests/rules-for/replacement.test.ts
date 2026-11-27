import assert from "node:assert/strict";
import { test } from "node:test";
import { PurlError } from "../../src/purl.js";
import { replacementFor, replacementsFor } from "../../src/replacement.js";
import { VersError } from "../../src/vers.js";

test("replacementFor returns the normalised replacement PURL or guidance for a matching version", () => {
  assert.equal(replacementFor("pkg:npm/node-sass", "9.0.0"), "pkg:npm/sass");
  assert.equal(replacementFor("pkg:npm/request", "2.88.2"), "Native fetch or a maintained HTTP client");
  assert.equal(replacementFor("pkg:npm/babel-preset-es2015", "6.24.1"), "pkg:npm/%40babel/preset-env");
});

test("replacementFor returns null for unmatched versions, unknown packages, and rules without a replacement", () => {
  assert.equal(replacementFor("pkg:generic/nodejs", "28.0.0"), null);
  assert.equal(replacementFor("pkg:npm/express", "4.21.0"), null);
  assert.equal(replacementFor("pkg:generic/mongodb", "5.0.0"), null);
});

test("replacementFor delegates input validation errors from check", () => {
  assert.throws(() => replacementFor("pkg:", "1.0.0"), PurlError);
  assert.throws(() => replacementFor("pkg:npm/request", ""), VersError);
});

test("replacementsFor covers a rule with structured items, a rule with text only, and no match", () => {
  // Rule with structured items (e.g. node-sass has sass successor)
  const nodeSassReplacements = replacementsFor("pkg:npm/node-sass", "9.0.0");
  assert.equal(nodeSassReplacements.length, 1);
  assert.equal(nodeSassReplacements[0]?.purl, "pkg:npm/sass");
  assert.equal(nodeSassReplacements[0]?.kind, "successor");

  // Rule with text only (e.g. left-pad has language feature guidance but no package replacements)
  const leftPadReplacements = replacementsFor("pkg:npm/left-pad", "1.3.0");
  assert.deepEqual(leftPadReplacements, []);

  // No match
  const noMatchReplacements = replacementsFor("pkg:npm/express", "4.21.0");
  assert.deepEqual(noMatchReplacements, []);
});
