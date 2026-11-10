import assert from "node:assert/strict";
import { test } from "node:test";

import { check } from "../../src/check.js";
import { daysLeft } from "../../src/result.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

test("a fixed asOf date gives a stable daysLeft for a future deadline", () => {
  assert.equal(daysLeft("2026-04-30", AS_OF), 29);
  assert.equal(daysLeft("2027-01-01", "2026-01-01"), 365);
});

test("past and same-day deadlines return null", () => {
  assert.equal(daysLeft("2026-03-31", AS_OF), null);
  assert.equal(daysLeft(AS_OF, AS_OF), null);
});

test("undated matches return null", () => {
  assert.equal(daysLeft(null, AS_OF), null);
});

test("check populates match daysLeft from the result asOf", () => {
  const result = check("pkg:generic/nodejs", "22.11.0", AS_OF);
  assert.equal(result.asOf, AS_OF);
  assert.equal(result.status, "scheduled");
  assert.equal(result.matches[0]?.date, "2027-04-30");
  assert.equal(result.matches[0]?.daysLeft, daysLeft("2027-04-30", AS_OF));
  assert.equal(result.matches[0]?.daysLeft, 394);
});
