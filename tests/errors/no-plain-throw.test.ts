/**
 * Guards against plain `throw new Error(...)` creeping back into src/.
 * Every intentional throw in src/ must use an EbbError subclass with a named code.
 * The only allowed exception is src/cjs-error.cts, which intentionally uses a bare Error.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const srcDir = join(fileURLToPath(import.meta.url), "../../../src");

function walkTs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walkTs(full);
    if (e.name.endsWith(".ts") && !e.name.endsWith(".cts")) return [full];
    return [];
  });
}

describe("no-plain-throw", () => {
  it("src/ has no bare throw new Error()", () => {
    const files = walkTs(srcDir);
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (line.includes("throw new Error(")) {
          violations.push(`${file}:${i + 1}`);
        }
      }
    }
    assert.deepEqual(violations, [], `Plain throw new Error found:\n${violations.join("\n")}`);
  });
});
