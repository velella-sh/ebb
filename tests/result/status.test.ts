import assert from "node:assert/strict";
import { test } from "node:test";

import type { CheckStatus } from "../../src/check.js";
import { resultStatuses, type ResultStatus } from "../../src/result.js";

const expectedStatuses = [
  "ok",
  "deprecated",
  "unsupported",
  "end-of-life",
  "removed",
  "scheduled",
] as const satisfies readonly ResultStatus[];

test("resultStatuses lists each status once, in the stable order", () => {
  assert.deepEqual([...resultStatuses], [...expectedStatuses]);
  assert.equal(new Set(resultStatuses).size, resultStatuses.length);
});

test("each ResultStatus is a member of the exported enum", () => {
  const byValue: Record<ResultStatus, true> = {
    ok: true,
    deprecated: true,
    unsupported: true,
    "end-of-life": true,
    removed: true,
    scheduled: true,
  };
  for (const status of expectedStatuses) {
    assert.equal(byValue[status], true);
    assert.ok((resultStatuses as readonly string[]).includes(status));
  }
});

test("CheckStatus is the same union as ResultStatus", () => {
  const status: CheckStatus = "unsupported";
  const asResult: ResultStatus = status;
  assert.equal(asResult, "unsupported");
});
