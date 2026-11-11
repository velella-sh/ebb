import assert from "node:assert/strict";
import { test } from "node:test";
import { CheckError, check } from "../../src/check.js";
import { checkAll, checkAllWith, isCheckAllError } from "../../src/check-all.js";

test("checkAll reports one error entry for a bad purl and returns the surrounding valid results", () => {
  const { results, summary } = checkAll([
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:", version: "1.0.0" },
    { purl: "pkg:npm/express", version: "4.21.0" },
  ]);

  assert.equal(results.length, 3);
  assert.equal(results[0]?.status, "deprecated");
  assert.ok(results[1] && isCheckAllError(results[1]));
  assert.equal(results[1].index, 1);
  assert.equal(results[1].code, "invalid-purl");
  assert.match(results[1].message, /missing a type/i);
  assert.equal(results[2]?.status, "ok");

  assert.equal(summary.total, 3);
  assert.equal(summary.errors, 1);
  assert.equal(summary.byStatus.deprecated, 1);
  assert.equal(summary.byStatus.ok, 1);
});

test("checkAll classifies invalid versions, product name errors, and unexpected failures cleanly", () => {
  const { results, summary } = checkAll([
    { purl: "pkg:generic/nodejs", version: "banana" },
    { purl: "pkg:generic/nodejs", version: "" },
    { purl: "no-such-package", version: "1.0.0" },
    { purl: "debian", version: "11.0.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
  ]);

  assert.equal(results.length, 5);
  assert.deepEqual(
    results.slice(0, 4).map((entry) => (isCheckAllError(entry) ? [entry.index, entry.code] : entry.status)),
    [
      [0, "invalid-version"],
      [1, "invalid-version"],
      [2, "unknown-product"],
      [3, "ambiguous-product"],
    ],
  );
  assert.equal(results[4]?.status, "deprecated");
  assert.equal(summary.errors, 4);
  assert.equal(summary.byStatus.deprecated, 1);

  const custom = checkAllWith(
    [
      { purl: "ambiguous", version: "1.0.0" },
      { purl: "boom", version: "1.0.0" },
    ],
    (purl) => {
      if (purl === "ambiguous") throw new CheckError('Ambiguous product name "ambiguous".');
      throw new Error("unexpected boom");
    },
  );
  assert.deepEqual(custom.results, [
    { status: "error", index: 0, code: "ambiguous-product", message: 'Ambiguous product name "ambiguous".' },
    { status: "error", index: 1, code: "check-failed", message: "unexpected boom" },
  ]);
  assert.equal(custom.summary.errors, 2);
});

test("checkAll deduplicates repeated failing pairs while assigning each entry its own index", () => {
  let calls = 0;
  const { results, summary } = checkAllWith(
    [
      { purl: "pkg:npm/", version: "1.0.0" },
      { purl: "pkg:npm/express", version: "4.21.0" },
      { purl: "pkg:npm/", version: "1.0.0" },
    ],
    (purl, version) => {
      calls += 1;
      return check(purl, version);
    },
  );

  assert.equal(calls, 2);
  assert.equal(summary.total, 3);
  assert.equal(summary.errors, 2);
  assert.equal(summary.byStatus.ok, 1);
  assert.ok(results[0] && isCheckAllError(results[0]));
  assert.ok(results[2] && isCheckAllError(results[2]));
  assert.equal(results[0].index, 0);
  assert.equal(results[2].index, 2);
  assert.equal(results[0].code, "invalid-purl");
  assert.equal(results[2].code, "invalid-purl");
});
