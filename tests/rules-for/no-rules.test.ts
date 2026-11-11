import assert from "node:assert/strict";
import { test } from "node:test";
import { PurlError } from "../../src/purl.js";
import { lifecycleEvents } from "../../src/registry.js";
import { replacementFor } from "../../src/replacement.js";
import { type RuleEvent, RulesForError, rulesFor } from "../../src/rules-for.js";

test("rulesFor returns [] for unknown packages across ecosystems without crashing", () => {
  const unknownPurls = [
    "pkg:npm/not-in-ebb-registry",
    "pkg:npm/%40nonexistent-scope/no-such-pkg",
    "pkg:pypi/no-such-python-package",
    "pkg:maven/com.example/nonexistent-artifact",
    "pkg:golang/example.com/missing/module",
    "pkg:cargo/no-such-crate-in-ebb",
    "pkg:generic/unknown-runtime-tool",
  ];

  for (const purl of unknownPurls) {
    assert.deepEqual(rulesFor(purl), []);
    for (const event of lifecycleEvents) {
      assert.deepEqual(rulesFor(purl, { event }), []);
    }
    assert.strictEqual(replacementFor(purl, "1.0.0"), null);
  }
});

test("rulesFor returns [] for known packages with zero rules in the registry", () => {
  const knownZeroRulePurls = [
    "pkg:npm/express",
    "pkg:npm/express@4.21.0?arch=x64#lib",
    "pkg:npm/typescript",
    "pkg:npm/lodash",
    "pkg:pypi/Requests",
    "pkg:pypi/requests@2.32.3",
    "pkg:cargo/serde",
  ];

  for (const purl of knownZeroRulePurls) {
    const result = rulesFor(purl);
    assert.deepEqual(result, []);
    // Mutating the empty return value never affects future lookups.
    result.push({} as never);
    assert.deepEqual(rulesFor(purl), []);

    for (const event of lifecycleEvents) {
      assert.deepEqual(rulesFor(purl, { event }), []);
    }
    assert.strictEqual(replacementFor(purl, "1.0.0"), null);
    assert.throws(() => rulesFor(purl, { event: "not-a-valid-event" as RuleEvent }), RulesForError);
  }
});

test("rulesFor throws typed PurlError for malformed or non-PURL inputs", () => {
  const invalidInputs = [
    "",
    "   ",
    "not-a-purl",
    "request",
    "pkg:",
    "pkg:/foo",
    "pkg:npm/",
    "pkg:1bad/foo",
    "pkg:pypi/foo/bar",
    "pkg:github/only-owner",
    "pkg:npm/foo?bad_key",
    "pkg:npm/foo?a=1&a=2",
    "pkg:npm/foo%ZZ",
  ];

  for (const invalid of invalidInputs) {
    assert.throws(
      () => rulesFor(invalid),
      (error: unknown) => error instanceof PurlError && error.code === "invalid-purl",
      `expected PurlError for ${JSON.stringify(invalid)}`,
    );
  }
});
