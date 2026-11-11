import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

import { SUPPORTED_SCHEMES } from "../../src/vers/schemes.js";

const versModuleUrl = new URL("../../src/vers.js", import.meta.url).href;

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
  const rewritten = code.replaceAll('"@velella/ebb/vers"', JSON.stringify(versModuleUrl));
  const transpiled = ts.transpileModule(rewritten, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
  });
  assert.deepEqual(transpiled.diagnostics ?? [], [], "doc TypeScript example should have no syntax diagnostics");

  const tempDir = await mkdtemp(join(tmpdir(), "ebb-vers-doc-"));
  try {
    const filePath = join(tempDir, "example.mjs");
    await writeFile(filePath, transpiled.outputText, "utf8");
    return execFileSync(process.execPath, [filePath], { encoding: "utf8" });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("docs/vers.md runnable example matches documented output", async () => {
  const markdown = await readFile(resolve("docs/vers.md"), "utf8");
  const blocks = extractFencedBlocks(markdown);

  assert.equal(blocks.length, 4, "expected 4 fenced code blocks in docs/vers.md");
  assert.equal(blocks[0]!.lang, "ts");
  assert.equal(blocks[1]!.lang, "json");

  const stdout = await runExampleBlock(blocks[0]!.code);
  assert.deepEqual(JSON.parse(stdout), JSON.parse(blocks[1]!.code));
});

test("docs/vers.md documents every supported scheme, unsupported scheme, and CI metrics", async () => {
  const markdown = await readFile(resolve("docs/vers.md"), "utf8");

  for (const scheme of Object.keys(SUPPORTED_SCHEMES)) {
    assert.ok(markdown.includes(`\`${scheme}\``), `docs/vers.md should list supported scheme "${scheme}"`);
  }
  for (const unsupported of ["apk", "alpm", "conan", "datetime", "gentoo", "lexicographic", "openssl", "nginx"]) {
    assert.ok(markdown.includes(`\`${unsupported}\``), `docs/vers.md should list unsupported scheme "${unsupported}"`);
  }
  for (const metric of ["`1064/1064`", "`920`", "`737`"]) {
    assert.ok(markdown.includes(metric), `docs/vers.md should document suite count ${metric}`);
  }
});
