import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../../src/check.js";
import { type CheckAllItem, checkAll, checkAllWith } from "../../src/check-all.js";

test("checkAll preserves reverse-sorted input order without sorting by name, version, or status", () => {
  const items: readonly CheckAllItem[] = [
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/node-sass", version: "9.0.0" },
    { purl: "pkg:generic/nodejs", version: "22.12.0" },
    { purl: "pkg:generic/nodejs", version: "18.20.0" },
  ];

  const results = checkAll(items);

  assert.equal(results.length, items.length);
  assert.deepEqual(
    results.map((result) => [result.status, result.version]),
    [
      ["ok", "4.21.0"],
      ["deprecated", "2.88.2"],
      ["end-of-life", "9.0.0"],
      ["scheduled", "22.12.0"],
      ["end-of-life", "18.20.0"],
    ],
  );
});

test("checkAll output index i always matches input index i for shuffled duplicates", () => {
  const uniquePairs: readonly CheckAllItem[] = [
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/node-sass", version: "9.0.0" },
    { purl: "pkg:generic/nodejs", version: "18.20.0" },
    { purl: "pkg:generic/nodejs", version: "22.12.0" },
    { purl: "pkg:npm/request", version: "2.88.0" },
  ];

  // Expand into 24 entries and deterministically shuffle with Fisher-Yates (LCG seed).
  const shuffled: CheckAllItem[] = [];
  for (let repeat = 0; repeat < 4; repeat += 1) {
    shuffled.push(...uniquePairs);
  }
  let state = 0x5eed1234;
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const calls: string[] = [];
  const results = checkAllWith(shuffled, (purl, version) => {
    calls.push(`${purl}@${version}`);
    return check(purl, version);
  });

  assert.equal(calls.length, uniquePairs.length);
  assert.equal(results.length, shuffled.length);
  for (let index = 0; index < shuffled.length; index += 1) {
    const item = shuffled[index]!;
    assert.deepEqual(results[index], check(item.purl, item.version), `mismatch at index ${index}`);
  }
});
