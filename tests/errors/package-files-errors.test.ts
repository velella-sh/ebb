import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { EbbError } from "../../src/errors.js";
import { findPackageFile, findPackageFileSync } from "../../src/package-files.js";

describe("package-file-not-found errors", () => {
  it("findPackageFileSync throws EbbError(package-file-not-found) when missing", () => {
    assert.throws(
      () => findPackageFileSync("nonexistent-file-that-does-not-exist.xyz", pathToFileURL("/").href),
      (err: unknown) => {
        assert.ok(err instanceof EbbError);
        assert.equal(err.code, "package-file-not-found");
        assert.match(err.message, /Ebb package file not found: nonexistent-file-that-does-not-exist\.xyz/);
        return true;
      },
    );
  });

  it("findPackageFile throws EbbError(package-file-not-found) when missing", async () => {
    await assert.rejects(
      () => findPackageFile("nonexistent-file-that-does-not-exist.xyz", pathToFileURL("/").href),
      (err: unknown) => {
        assert.ok(err instanceof EbbError);
        assert.equal(err.code, "package-file-not-found");
        assert.match(err.message, /Ebb package file not found: nonexistent-file-that-does-not-exist\.xyz/);
        return true;
      },
    );
  });
});
