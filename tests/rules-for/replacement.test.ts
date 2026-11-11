import assert from "node:assert/strict";
import { test } from "node:test";
import { PurlError } from "../../src/purl.js";
import { replacementFor } from "../../src/replacement.js";
import { VersError } from "../../src/vers.js";

test("replacementFor returns the replacement for a deprecated or end-of-life package version", () => {
  assert.equal(replacementFor("pkg:npm/node-sass", "9.0.0"), "sass");
  assert.equal(replacementFor("pkg:npm/request", "2.88.2"), "Native fetch or a maintained HTTP client");
  assert.equal(replacementFor("pkg:npm/babel-preset-es2015", "6.24.1"), "@babel/preset-env");
});

test("replacementFor returns null for unmatched versions, unknown packages, and rules without a replacement", () => {
  assert.equal(replacementFor("pkg:generic/nodejs", "24.0.0"), null);
  assert.equal(replacementFor("pkg:npm/express", "4.21.0"), null);
  assert.equal(replacementFor("pkg:generic/mongodb", "5.0.0"), null);
});

test("replacementFor delegates input validation errors from check", () => {
  assert.throws(() => replacementFor("pkg:", "1.0.0"), PurlError);
  assert.throws(() => replacementFor("pkg:npm/request", ""), VersError);
});
