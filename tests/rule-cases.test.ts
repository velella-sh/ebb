import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkCases, matchingRules, renderCaseFailure } from "../tools/rule-cases.js";
import type { RegistryV2Rule } from "../src/registry.js";

test("every case in cases/ is judged by exactly the rules it names", async () => {
  const result = await checkCases(".");
  assert.ok(result.checked > 0, "cases/ holds at least one case");
  assert.deepEqual(result.failures.map(renderCaseFailure), []);
});

test("matchingRules compares purl identities and version ranges and skips symbol rules", () => {
  const rules = [
    { id: "a", purl: "pkg:generic/nodejs", vers: "vers:semver/>=18.0.0|<19.0.0" },
    { id: "b", purl: "pkg:generic/nodejs", vers: "vers:semver/<18.0.0" },
    { id: "c", purl: "pkg:npm/request", vers: "vers:npm/*" },
    { id: "d", purl: "pkg:generic/nodejs", vers: "vers:semver/*", usage: [{ kind: "symbol" }] },
  ] as unknown as RegistryV2Rule[];
  assert.deepEqual(matchingRules(rules, "pkg:generic/nodejs", "18.4.0"), ["a"]);
  assert.deepEqual(matchingRules(rules, "pkg:generic/nodejs", "16.0.0"), ["b"]);
  assert.deepEqual(matchingRules(rules, "pkg:generic/nodejs", "22.0.0"), []);
  assert.deepEqual(matchingRules(rules, "pkg:npm/request@2.88.2", "2.88.2"), ["c"]);
});

test("a case that expects the wrong rules fails and names what matched", async () => {
  const root = await mkdtemp(join(tmpdir(), "ebb-cases-"));
  await mkdir(join(root, "registry"));
  await mkdir(join(root, "cases"));
  await writeFile(join(root, "registry", "npm.json"), JSON.stringify({ schemaVersion: "other" }));
  await writeFile(
    join(root, "cases", "npm.json"),
    JSON.stringify({
      cases: [{ purl: "pkg:npm/request", version: "2.88.2", rules: ["npm.package.request.deprecated"] }],
    }),
  );
  const result = await checkCases(root);
  assert.equal(result.checked, 1);
  assert.deepEqual(result.failures.map(renderCaseFailure), [
    "cases/npm.json: pkg:npm/request@2.88.2 expected npm.package.request.deprecated, got no rule",
  ]);
});

test("with rule ids, only the cases those rules can change are checked", async () => {
  const all = await checkCases(".");
  const some = await checkCases(".", new Set(["nodejs.runtime.eol-18"]));
  assert.ok(some.checked > 0 && some.checked < all.checked);
});
