import assert from "node:assert/strict";
import test from "node:test";
import { bundledRules } from "../../../src/bundled-rules.js";
import { check, checkAll, replacementFor, rulesFor } from "../../../src/index.js";
import { parsePurl } from "../../../src/purl.js";

test("offing contract: check returns schemaVersion 1 with expected fields", () => {
  const result = check("pkg:npm/left-pad", "1.3.0");
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, "deprecated");
  assert.equal(result.version, "1.3.0");
  assert.ok(Array.isArray(result.matches));
  assert.ok(result.matches.length > 0);

  const match = result.matches[0];
  assert.ok(match);
  assert.equal(typeof match.ruleId, "string");
  assert.equal(typeof match.event, "string");
  assert.ok(Array.isArray(match.sources));
  assert.ok(match.sources.length > 0);
  assert.equal(typeof match.sources[0]?.url, "string");
});

test("offing contract: check handles clean components", () => {
  const result = check("pkg:generic/nodejs", "24.0.0");
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.matches, []);
});

test("offing contract: checkAll returns batch results and summary", () => {
  const batch = [
    { purl: "pkg:npm/left-pad", version: "1.3.0" },
    { purl: "pkg:generic/nodejs", version: "24.0.0" },
    { purl: "node", version: "18.20.4" },
  ];

  const response = checkAll(batch);
  assert.equal(response.results.length, 3);
  assert.equal(response.summary.total, 3);
  assert.equal(response.summary.errors, 0);
  assert.equal(response.summary.byStatus.deprecated, 1);
  assert.equal(response.summary.byStatus["end-of-life"], 1);
  assert.equal(response.summary.byStatus.ok, 1);
});

test("offing contract: replacementFor returns string or null", () => {
  const replacement = replacementFor("pkg:npm/left-pad", "1.3.0");
  assert.equal(typeof replacement, "string");
  assert.ok(replacement?.includes("padStart"));

  const noReplacement = replacementFor("pkg:npm/unknown-package-xyz", "1.0.0");
  assert.equal(noReplacement, null);
});

test("offing contract: rulesFor returns list of rules for a component", () => {
  const rules = rulesFor("pkg:npm/left-pad");
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 1);
  assert.ok(rules[0]?.id.includes("left-pad"));
  assert.equal(rules[0]?.purl, "pkg:npm/left-pad");
});

test("offing contract: parsePurl canonicalizes component identifiers", () => {
  const parsed = parsePurl("pkg:npm/%40babel/core@7.0.0");
  assert.equal(parsed.type, "npm");
  assert.equal(parsed.namespace, "@babel");
  assert.equal(parsed.name, "core");
  assert.equal(parsed.version, "7.0.0");
});

test("offing contract: bundledRules returns all built-in rules", async () => {
  const rules = await bundledRules();
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 300);
});
