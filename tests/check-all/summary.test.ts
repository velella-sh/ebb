import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../../src/check.js";
import { type CheckAllItem, checkAll } from "../../src/check-all.js";

test("checkAll returns zeroed summary counts for an empty input", () => {
  const { results, summary } = checkAll([]);

  assert.deepEqual(results, []);
  assert.deepEqual(summary, {
    total: 0,
    byStatus: {
      ok: 0,
      deprecated: 0,
      unsupported: 0,
      "end-of-life": 0,
      removed: 0,
      scheduled: 0,
    },
    byEvent: {
      deprecated: 0,
      unsupported: 0,
      "end-of-life": 0,
      removed: 0,
      scheduled: 0,
    },
  });
});

test("checkAll summarizes counts per status and per event on a mixed batch including duplicates", () => {
  const items: readonly CheckAllItem[] = [
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/node-sass", version: "9.0.0" },
    { purl: "pkg:generic/dotnet", version: "9.0.0" },
    { purl: "pkg:generic/cmake", version: "3.4.0" },
    { purl: "pkg:generic/nodejs", version: "22.12.0" },
    { purl: "pkg:npm/express", version: "4.21.0" },
    { purl: "pkg:generic/nodejs", version: "18.20.0" },
  ];

  const { results, summary } = checkAll(items);

  assert.equal(results.length, items.length);
  assert.equal(summary.total, items.length);
  assert.deepEqual(summary.byStatus, {
    ok: 2,
    deprecated: 1,
    unsupported: 1,
    "end-of-life": 2,
    removed: 1,
    scheduled: 1,
  });

  // node-sass@9.0.0 matches both end-of-life and deprecated rules, while status keeps only the primary verdict.
  const expectedByEvent = {
    deprecated: 0,
    unsupported: 0,
    "end-of-life": 0,
    removed: 0,
    scheduled: 0,
  };
  for (const item of items) {
    for (const match of check(item.purl, item.version).matches) {
      expectedByEvent[match.event] += 1;
    }
  }
  assert.deepEqual(summary.byEvent, expectedByEvent);
  assert.ok(summary.byEvent.deprecated >= 2);
});
