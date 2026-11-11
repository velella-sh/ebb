import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";

test("require('@velella/ebb') fails with a clear message pointing to ESM import", () => {
  const require = createRequire(import.meta.url);
  assert.throws(
    () => require("@velella/ebb"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ESM-only/i);
      assert.match(error.message, /import\s*\(/i);
      return true;
    },
  );

  const child = spawnSync(process.execPath, ["--input-type=commonjs", "-e", "require('@velella/ebb')"], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /@velella\/ebb is ESM-only/);
  assert.match(child.stderr, /await import\("@velella\/ebb"\)/);
});
