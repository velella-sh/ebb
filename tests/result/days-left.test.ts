import assert from "node:assert/strict";
import { test } from "node:test";

import { daysLeft } from "../../src/result.js";

test("a fixed asOf date gives a stable daysLeft for a future deadline", () => {
  assert.equal(daysLeft("2026-04-30", "2026-04-01"), 29);
  assert.equal(daysLeft("2027-01-01", "2026-01-01"), 365);
});

test("past and same-day deadlines return null", () => {
  assert.equal(daysLeft("2026-03-31", "2026-04-01"), null);
  assert.equal(daysLeft("2026-04-01", "2026-04-01"), null);
});

test("undated matches return null", () => {
  assert.equal(daysLeft(null, "2026-04-01"), null);
});
