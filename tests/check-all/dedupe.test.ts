import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../../src/check.js";
import { checkAll, checkAllWith } from "../../src/check-all.js";

test("checkAll calls check once per unique purl and version pair while preserving output length", () => {
  const calls: Array<{ purl: string; version: string }> = [];
  const items = [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
  ] as const;

  const { results } = checkAllWith(items, (purl, version) => {
    calls.push({ purl, version });
    return check(purl, version);
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls, [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/express", version: "4.21.0" },
  ]);
  assert.equal(results.length, items.length);
  assert.equal(results[0], results[2]);
  assert.equal(results[0], results[4]);
  assert.equal(results[1], results[3]);
});

test("checkAll distinguishes distinct version spellings for the same purl", () => {
  const calls: string[] = [];
  const items = [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/request", version: "v2.88.2" },
    { purl: "pkg:npm/request", version: "2.88.2" },
  ] as const;

  const { results } = checkAllWith(items, (purl, version) => {
    calls.push(`${purl}@${version}`);
    return check(purl, version);
  });

  assert.deepEqual(calls, ["pkg:npm/request@2.88.2", "pkg:npm/request@v2.88.2"]);
  assert.ok(results[0] && results[0].status !== "error");
  assert.ok(results[1] && results[1].status !== "error");
  assert.ok(results[2] && results[2].status !== "error");
  assert.equal(results[0].version, "2.88.2");
  assert.equal(results[1].version, "v2.88.2");
  assert.equal(results[2].version, "2.88.2");
});

test("checkAll does not collide on delimiter characters inside purl or version", () => {
  const calls: Array<[string, string]> = [];
  const { results } = checkAllWith(
    [
      { purl: "pkg:npm/a\x00b", version: "1.0.0" },
      { purl: "pkg:npm/a", version: "b\x001.0.0" },
    ],
    (purl, version) => {
      calls.push([purl, version]);
      return { schemaVersion: 1, status: "ok", matches: [], version };
    },
  );

  assert.equal(calls.length, 2);
  assert.ok(results[0] && results[0].status !== "error");
  assert.ok(results[1] && results[1].status !== "error");
  assert.equal(results[0].version, "1.0.0");
  assert.equal(results[1].version, "b\x001.0.0");
});

test("checkAll copies identical results to every duplicate position on real data", () => {
  const { results } = checkAll([
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
  ]);

  assert.equal(results.length, 3);
  assert.equal(results[0]?.status, "deprecated");
  assert.equal(results[1]?.status, "ok");
  assert.equal(results[0], results[2]);
});
