import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { lifecycleEvents } from "../../src/registry.js";

const rulesForModuleUrl = new URL("../../src/rules-for.js", import.meta.url).href;
const replacementModuleUrl = new URL("../../src/replacement.js", import.meta.url).href;

interface FencedBlock {
  readonly lang: string;
  readonly code: string;
}

function extractFencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const pattern = /^```([a-z0-9_-]+)\r?\n([\s\S]*?)^```$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push({ lang: match[1]!, code: match[2]! });
  }
  return blocks;
}

async function runExampleBlock(code: string): Promise<string> {
  const rewritten = code
    .replaceAll('"@velella/ebb/rules-for"', JSON.stringify(rulesForModuleUrl))
    .replaceAll('"@velella/ebb/replacement"', JSON.stringify(replacementModuleUrl));
  const transpiled = ts.transpileModule(rewritten, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
  });
  assert.deepEqual(transpiled.diagnostics ?? [], [], "doc TypeScript example should have no syntax diagnostics");

  const tempDir = await mkdtemp(join(tmpdir(), "ebb-rules-for-doc-"));
  try {
    const filePath = join(tempDir, "example.mjs");
    await writeFile(filePath, transpiled.outputText, "utf8");
    return execFileSync(process.execPath, [filePath], { encoding: "utf8" });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("docs/rules-for.md runnable examples execute as written and match documented outputs", async () => {
  const markdown = await readFile(resolve("docs/rules-for.md"), "utf8");
  const blocks = extractFencedBlocks(markdown);

  // Block 0: import snippet; Block 1 + 2: rulesFor ts example + json output;
  // Block 3 + 4: replacementFor ts example + json output.
  assert.equal(blocks.length, 5, "expected 5 fenced code blocks in docs/rules-for.md");

  assert.equal(blocks[0]!.lang, "ts");
  await runExampleBlock(blocks[0]!.code);

  assert.equal(blocks[1]!.lang, "ts");
  assert.equal(blocks[2]!.lang, "json");
  const rulesStdout = await runExampleBlock(blocks[1]!.code);
  assert.deepEqual(JSON.parse(rulesStdout), JSON.parse(blocks[2]!.code));

  assert.equal(blocks[3]!.lang, "ts");
  assert.equal(blocks[4]!.lang, "json");
  const replacementStdout = await runExampleBlock(blocks[3]!.code);
  assert.deepEqual(JSON.parse(replacementStdout), JSON.parse(blocks[4]!.code));
});

test("docs/rules-for.md documents all lifecycle event filters and typed errors", async () => {
  const markdown = await readFile(resolve("docs/rules-for.md"), "utf8");
  for (const event of lifecycleEvents) {
    assert.ok(markdown.includes(`\`"${event}"\``), `docs/rules-for.md should document event "${event}"`);
  }
  for (const symbol of ["rulesFor", "replacementFor", "Rule", "RuleEvent", "RulesForOptions", "RulesForError"]) {
    assert.ok(markdown.includes(`\`${symbol}`), `docs/rules-for.md should document ${symbol}`);
  }
});
