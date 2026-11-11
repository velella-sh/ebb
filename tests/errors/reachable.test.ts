/**
 * Verifies that every EBB_ERROR_CODES entry can be triggered and is an EbbError with the expected code.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { EBB_ERROR_CODES, EbbError } from "../../src/errors.js";
import { parsePurl } from "../../src/purl.js";
import { versContains } from "../../src/vers.js";
import { daysLeft } from "../../src/result.js";
import { required } from "../../src/required.js";
import { findPackageFileSync } from "../../src/package-files.js";
import { DataUpdateError } from "../../src/data-update.js";
import { DataPinError } from "../../src/data-source.js";

function catchEbb(fn: () => unknown): EbbError {
  try {
    fn();
    throw new Error("Expected EbbError but nothing was thrown");
  } catch (err) {
    assert(err instanceof EbbError, `Expected EbbError, got: ${err}`);
    return err;
  }
}

describe("error codes reachable", () => {
  const coveredCodes = new Set<string>();

  it("invalid-purl is reachable", () => {
    const err = catchEbb(() => parsePurl("not-a-purl"));
    assert.equal(err.code, "invalid-purl");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("invalid-version is reachable", () => {
    const err = catchEbb(() => versContains("vers:npm/1.0.0", "not-valid!!!"));
    assert.equal(err.code, "invalid-version");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("invalid-date is reachable", () => {
    const err = catchEbb(() => daysLeft(null, "not-a-date"));
    assert.equal(err.code, "invalid-date");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("package-file-not-found is reachable", () => {
    const err = catchEbb(() => findPackageFileSync("nonexistent-file.xyz", pathToFileURL("/").href));
    assert.equal(err.code, "package-file-not-found");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("internal is reachable", () => {
    const err = catchEbb(() => required(undefined, "test-field"));
    assert.equal(err.code, "internal");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("data-update-failed is reachable", () => {
    const err = catchEbb(() => {
      throw new DataUpdateError("update failed");
    });
    assert.equal(err.code, "data-update-failed");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("data-unavailable is reachable", () => {
    const err = catchEbb(() => {
      throw new DataPinError("data unavailable");
    });
    assert.equal(err.code, "data-unavailable");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("invalid-data-version is reachable", () => {
    const err = catchEbb(() => {
      throw new DataPinError("malformed version string", true);
    });
    assert.equal(err.code, "invalid-data-version");
    assert(err instanceof EbbError);
    coveredCodes.add(err.code);
  });

  it("every code in EBB_ERROR_CODES is covered", () => {
    for (const code of EBB_ERROR_CODES) {
      assert.ok(coveredCodes.has(code), `Code "${code}" must have a reachability test`);
    }
  });
});
