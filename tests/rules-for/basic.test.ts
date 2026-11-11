import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { PurlError, purlIdentity } from "../../src/purl.js";
import { type Rule, rulesFor } from "../../src/rules-for.js";

// Compiled to dist/tests/rules-for/, three levels below the package root.
const packageRoot = join(import.meta.dirname, "..", "..", "..");

async function readRegistryRulesFor(purl: string): Promise<Rule[]> {
  const identity = purlIdentity(purl);
  const matching: Rule[] = [];
  for (const name of (await readdir(join(packageRoot, "registry"))).sort()) {
    if (!name.endsWith(".json") || name === "sources.lock.json") continue;
    const raw = JSON.parse(await readFile(join(packageRoot, "registry", name), "utf8")) as {
      schemaVersion?: unknown;
      rules?: Rule[];
    };
    if (raw.schemaVersion !== "ebb.registry.v2" || !Array.isArray(raw.rules)) continue;
    for (const rule of raw.rules) {
      if (purlIdentity(rule.purl) === identity) matching.push(rule);
    }
  }
  return matching;
}

const sortedIds = (rules: readonly Rule[]): string[] => rules.map((rule) => rule.id).sort((a, b) => a.localeCompare(b));

test("rulesFor returns every rule of a known component", async () => {
  for (const purl of ["pkg:npm/request", "pkg:npm/left-pad", "pkg:generic/nodejs", "pkg:pypi/django"]) {
    const actual = rulesFor(purl);
    const expected = await readRegistryRulesFor(purl);
    assert.ok(expected.length > 0, `expected bundled rules for ${purl}`);
    assert.deepEqual(sortedIds(actual), sortedIds(expected));
  }
});

test("rulesFor normalises variants of the same purl before lookup", () => {
  const canonical = rulesFor("pkg:npm/left-pad");
  assert.deepEqual(sortedIds(rulesFor("pkg:npm/Left-Pad@1.3.0?Arch=x64#dist/index.js")), sortedIds(canonical));
  assert.deepEqual(sortedIds(rulesFor("  pkg:pypi/Django@4.2.0  ")), sortedIds(rulesFor("pkg:pypi/django")));
});

test("rulesFor returns an empty array when no rules exist", () => {
  assert.deepEqual(rulesFor("pkg:npm/this-package-does-not-exist-in-ebb"), []);
  assert.deepEqual(rulesFor("pkg:npm/express"), []);
});

test("rulesFor returns a fresh copy so callers cannot mutate the cached index", () => {
  const first = rulesFor("pkg:npm/left-pad");
  assert.equal(first.length, 1);
  first.pop();
  assert.equal(rulesFor("pkg:npm/left-pad").length, 1);
});

test("rulesFor rejects invalid purls with PurlError", () => {
  assert.throws(() => rulesFor("not-a-purl"), PurlError);
  assert.throws(() => rulesFor("pkg:"), PurlError);
});
