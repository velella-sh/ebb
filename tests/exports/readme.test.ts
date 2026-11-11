import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { check, checkAll, replacementFor, rulesFor } from "../../src/index.js";

const rootModuleUrl = new URL("../../src/index.js", import.meta.url).href;

function extractTsBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const pattern = /^```ts\r?\n([\s\S]*?)^```$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push(match[1]!);
  }
  return blocks;
}

test("every README TypeScript example imports from the root @velella/ebb entry and runs cleanly", async () => {
  const markdown = await readFile(resolve("README.md"), "utf8");
  const blocks = extractTsBlocks(markdown);
  assert.equal(blocks.length, 3, "expected 3 TypeScript usage examples in README.md");
  assert.doesNotMatch(markdown, /@velella\/ebb\//, "README.md must not import from legacy subpaths");

  const tempDir = await mkdtemp(join(tmpdir(), "ebb-readme-examples-"));
  try {
    for (const [index, code] of blocks.entries()) {
      assert.match(code, /from "@velella\/ebb";/, `block ${index} should import from "@velella/ebb"`);
      const rewritten = code.replaceAll('"@velella/ebb"', JSON.stringify(rootModuleUrl));
      const transpiled = ts.transpileModule(rewritten, {
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          strict: true,
        },
      });
      assert.deepEqual(transpiled.diagnostics ?? [], [], `block ${index} should transpile without diagnostics`);

      const scriptPath = join(tempDir, `example-${index}.mjs`);
      await writeFile(scriptPath, transpiled.outputText, "utf8");
      execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("README example expressions produce the documented results", () => {
  const node = check("node", "18.20.4");
  assert.equal(node.status, "end-of-life");
  assert.equal(node.matches[0]?.date, "2025-04-30");

  const request = check("pkg:npm/request", "2.88.2");
  assert.equal(request.status, "deprecated");
  assert.equal(replacementFor("pkg:npm/request", "2.88.2"), "Native fetch or a maintained HTTP client");

  assert.equal(check("pkg:npm/left-pad", "1.3.0").status, "deprecated");
  assert.deepEqual(check("pkg:generic/nodejs", "24.0.0"), {
    schemaVersion: 1,
    status: "ok",
    matches: [],
    version: "24.0.0",
  });

  const node22 = check("pkg:generic/nodejs", "22.11.0", "2026-04-01");
  assert.equal(node22.status, "scheduled");
  assert.equal(node22.asOf, "2026-04-01");
  assert.equal(node22.matches[0]?.daysLeft, 394);

  const pythonEolRules = rulesFor("pkg:generic/python", { event: "end-of-life" });
  assert.equal(
    pythonEolRules.some((rule) => rule.id === "python.runtime.eol-3.10-and-older"),
    true,
  );

  const batch = checkAll([
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:generic/nodejs", version: "18.20.4" },
  ]);
  assert.equal(batch.summary.total, 2);
});
