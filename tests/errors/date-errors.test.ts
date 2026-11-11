import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EbbError } from "../../src/errors.js";
import { daysLeft } from "../../src/result.js";
import { buildForecast } from "../../src/forecast.js";

describe("invalid-date errors", () => {
  it("daysLeft throws EbbError(invalid-date) on bad asOf", () => {
    assert.throws(
      () => daysLeft(null, "invalid-date"),
      (err: unknown) => {
        assert.ok(err instanceof EbbError);
        assert.equal(err.code, "invalid-date");
        assert.match(err.message, /"invalid-date" is not a date \(YYYY-MM-DD\)\./);
        return true;
      },
    );
  });

  it("buildForecast throws EbbError(invalid-date) on bad today", () => {
    assert.throws(
      () => buildForecast({ root: "/", findings: [] }, [], "not-a-date"),
      (err: unknown) => {
        assert.ok(err instanceof EbbError);
        assert.equal(err.code, "invalid-date");
        assert.match(err.message, /"not-a-date" is not a date \(YYYY-MM-DD\)\./);
        return true;
      },
    );
  });
});
