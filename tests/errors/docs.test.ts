import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EBB_ERROR_CODES } from "../../src/errors.js";

describe("docs/ERRORS.md documentation coverage", () => {
  it("documents every EbbErrorCode in docs/ERRORS.md", async () => {
    const content = await readFile(resolve("docs/ERRORS.md"), "utf8");
    for (const code of EBB_ERROR_CODES) {
      assert.ok(content.includes(`### \`${code}\``), `docs/ERRORS.md must document code ### \`${code}\``);
      assert.ok(content.includes(`**Cause:**`), `docs/ERRORS.md must document Cause for ${code}`);
      assert.ok(content.includes(`**Fix:**`), `docs/ERRORS.md must document Fix for ${code}`);
    }
  });
});
