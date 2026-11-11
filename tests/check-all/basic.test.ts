import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../../src/check.js";
import { checkAll } from "../../src/check-all.js";

test("checkAll returns three matching results for three items", () => {
  const items = [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/node-sass", version: "9.0.0" },
    { purl: "pkg:npm/express", version: "4.21.0" },
  ] as const;

  const results = checkAll(items);

  assert.equal(results.length, 3);
  assert.deepEqual(
    results,
    items.map((item) => check(item.purl, item.version)),
  );
  assert.equal(results[0]?.status, "deprecated");
  assert.equal(results[1]?.status, "end-of-life");
  assert.equal(results[2]?.status, "ok");
});

test("checkAll returns an empty list for an empty input", () => {
  assert.deepEqual(checkAll([]), []);
});
