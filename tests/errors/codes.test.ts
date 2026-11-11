import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EBB_ERROR_CODES, EbbError } from "../../src/errors.js";

describe("error codes", () => {
  it("includes all 8 error codes", () => {
    const expected = [
      "invalid-purl",
      "invalid-version",
      "invalid-data-version",
      "data-unavailable",
      "data-update-failed",
      "invalid-date",
      "package-file-not-found",
      "internal",
    ];
    assert.deepEqual([...EBB_ERROR_CODES].sort(), [...expected].sort());
  });

  it("can construct an EbbError with new codes", () => {
    const dateErr = new EbbError("invalid-date", "bad date");
    assert.equal(dateErr.code, "invalid-date");
    assert.ok(dateErr.message.startsWith("bad date"));

    const fileErr = new EbbError("package-file-not-found", "missing file");
    assert.equal(fileErr.code, "package-file-not-found");
    assert.ok(fileErr.message.startsWith("missing file"));

    const internalErr = new EbbError("internal", "logic error");
    assert.equal(internalErr.code, "internal");
    assert.ok(internalErr.message.startsWith("logic error"));
  });
});
