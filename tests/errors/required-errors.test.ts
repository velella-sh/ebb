import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EbbError } from "../../src/errors.js";
import { required } from "../../src/required.js";

describe("required helper errors", () => {
  it("throws EbbError(internal) when value is undefined", () => {
    assert.throws(
      () => required(undefined, "expected-key"),
      (err: unknown) => {
        assert.ok(err instanceof EbbError);
        assert.equal(err.code, "internal");
        assert.equal(err.message, "missing expected-key");
        return true;
      },
    );
  });

  it("returns value when defined", () => {
    assert.equal(required(123, "number"), 123);
    assert.equal(required(false, "boolean"), false);
    assert.equal(required("", "string"), "");
    assert.equal(required(null, "null"), null);
  });
});
