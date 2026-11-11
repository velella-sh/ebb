import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { purlIdentity } from "../../src/purl.js";
import { lifecycleEvents } from "../../src/registry.js";
import { type Rule, rulesFor } from "../../src/rules-for.js";
import { parseVersLenient, versionScheme } from "../../src/vers/index.js";

// Compiled to dist/tests/rules-for/, three levels below the package root.
const packageRoot = join(import.meta.dirname, "..", "..", "..");

async function readComponentRules(registryFile: string, componentPurl: string): Promise<Rule[]> {
  const raw = JSON.parse(await readFile(join(packageRoot, "registry", registryFile), "utf8")) as { rules: Rule[] };
  const identity = purlIdentity(componentPurl);
  return raw.rules.filter((rule) => purlIdentity(rule.purl) === identity);
}

type RangeStart =
  | { readonly bounded: false }
  | { readonly bounded: true; readonly scheme: string; readonly version: string; readonly inclusive: boolean };

function startOf(vers: string): RangeStart {
  const parsed = parseVersLenient(vers);
  if (parsed.all) return { bounded: false };
  const first = parsed.constraints.find((constraint) => constraint.comparator !== "!=");
  if (!first || first.comparator === "<" || first.comparator === "<=") return { bounded: false };
  return {
    bounded: true,
    scheme: parsed.scheme,
    version: first.version,
    inclusive: first.comparator === "=" || first.comparator === ">=",
  };
}

function compareStartAndId(left: Rule, right: Rule): number {
  const a = startOf(left.vers);
  const b = startOf(right.vers);
  if (!a.bounded && b.bounded) return -1;
  if (a.bounded && !b.bounded) return 1;
  if (a.bounded && b.bounded) {
    const scheme = versionScheme(a.scheme);
    const byVersion = scheme.compare(a.version, b.version);
    if (byVersion !== 0) return byVersion;
    if (a.inclusive !== b.inclusive) return a.inclusive ? -1 : 1;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function assertMonotonicOldestFirst(rules: readonly Rule[], label: string): void {
  for (let index = 1; index < rules.length; index += 1) {
    const previous = rules[index - 1]!;
    const current = rules[index]!;
    assert.ok(
      compareStartAndId(previous, current) <= 0,
      `${label}: expected ${previous.id} (${previous.vers}) before ${current.id} (${current.vers})`,
    );
  }
}

test("rulesFor returns full count, oldest-first order, and event filters for Node.js", async () => {
  const purl = "pkg:generic/nodejs";
  const expected = await readComponentRules("nodejs.json", purl);
  const actual = rulesFor(purl);

  assert.ok(actual.length >= 80, `expected at least 80 Node.js rules, got ${actual.length}`);
  assert.equal(actual.length, expected.length);
  assert.deepEqual(actual.map((rule) => rule.id).sort(), expected.map((rule) => rule.id).sort());

  // Includes both runtime version rules and symbol rules.
  assert.ok(actual.some((rule) => rule.usage === undefined || rule.usage.some((u) => u.kind !== "symbol")));
  assert.ok(actual.some((rule) => rule.usage?.every((u) => u.kind === "symbol")));

  assertMonotonicOldestFirst(actual, purl);
  assert.equal(actual[0]?.id, "nodejs.runtime.legacy");
  assert.equal(actual[1]?.id, "nodejs.symbol.fs.lchmod");
  assert.equal(actual[actual.length - 1]?.id, "nodejs.symbol.module.register");

  // Equal range starts (>=25.0.0) are broken stably by rule id.
  const v25Rules = actual.filter((rule) => rule.vers === "vers:semver/>=25.0.0").map((rule) => rule.id);
  assert.ok(v25Rules.length >= 4);
  assert.deepEqual(
    v25Rules,
    [...v25Rules].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  );

  let eventTotal = 0;
  for (const event of lifecycleEvents) {
    const filtered = rulesFor(purl, { event });
    const slice = actual.filter((rule) => rule.event === event);
    assert.deepEqual(filtered, slice);
    eventTotal += filtered.length;
  }
  assert.equal(eventTotal, actual.length);
  assert.ok(rulesFor(purl, { event: "deprecated" }).length > 0);
  assert.ok(rulesFor(purl, { event: "end-of-life" }).length > 0);
  assert.ok(rulesFor(purl, { event: "removed" }).length > 0);
  assert.ok(rulesFor(purl, { event: "scheduled-end-of-life" }).length > 0);
  assert.deepEqual(rulesFor(purl, { event: "end-of-support" }), []);
});

test("rulesFor returns full count, oldest-first order, and event filters for Python", async () => {
  const purl = "pkg:generic/python";
  const expected = await readComponentRules("python.json", purl);
  const actual = rulesFor(purl);

  assert.ok(actual.length >= 70, `expected at least 70 Python rules, got ${actual.length}`);
  assert.equal(actual.length, expected.length);
  assert.deepEqual(actual.map((rule) => rule.id).sort(), expected.map((rule) => rule.id).sort());

  assert.ok(actual.some((rule) => rule.usage === undefined || rule.usage.some((u) => u.kind !== "symbol")));
  assert.ok(actual.some((rule) => rule.usage?.every((u) => u.kind === "symbol")));

  assertMonotonicOldestFirst(actual, purl);
  assert.equal(actual[0]?.id, "python.runtime.eol-3.10-and-older");
  assert.equal(actual[1]?.id, "python.runtime.eol-3.9-and-older");
  assert.equal(actual[2]?.id, "python.symbol.ast.constant-nodes");
  assert.equal(actual[actual.length - 1]?.id, "python.symbol.sysconfig.expand-makefile-vars");

  // Equal range starts (>=3.12) are broken stably by rule id.
  const v312Rules = actual.filter((rule) => rule.vers === "vers:pypi/>=3.12").map((rule) => rule.id);
  assert.ok(v312Rules.length >= 5);
  assert.deepEqual(
    v312Rules,
    [...v312Rules].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  );

  let eventTotal = 0;
  for (const event of lifecycleEvents) {
    const filtered = rulesFor(purl, { event });
    const slice = actual.filter((rule) => rule.event === event);
    assert.deepEqual(filtered, slice);
    eventTotal += filtered.length;
  }
  assert.equal(eventTotal, actual.length);
  assert.ok(rulesFor(purl, { event: "deprecated" }).length > 0);
  assert.ok(rulesFor(purl, { event: "end-of-life" }).length > 0);
  assert.ok(rulesFor(purl, { event: "removed" }).length > 0);
  assert.deepEqual(rulesFor(purl, { event: "end-of-support" }), []);
  assert.deepEqual(rulesFor(purl, { event: "scheduled-end-of-life" }), []);
});
