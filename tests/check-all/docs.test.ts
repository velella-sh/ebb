import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { type CheckAllEntry, checkAll } from "../../src/check-all.js";
import { EBB_ERROR_CODES } from "../../src/errors.js";

const checkAllModuleUrl = new URL("../../src/check-all.js", import.meta.url).href;

interface FencedBlock {
  readonly lang: string;
  readonly code: string;
  readonly index: number;
}

function extractFencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const pattern = /^```([a-z0-9_-]+)\r?\n([\s\S]*?)^```$/gm;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push({
      lang: match[1]!,
      code: match[2]!,
      index,
    });
    index += 1;
  }
  return blocks;
}

async function runExampleBlock(code: string): Promise<string> {
  const rewritten = code.replaceAll('"@velella/ebb/check-all"', JSON.stringify(checkAllModuleUrl));
  const transpiled = ts.transpileModule(rewritten, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
  });
  assert.deepEqual(transpiled.diagnostics ?? [], [], "doc TypeScript example should have no syntax diagnostics");

  const tempDir = await mkdtemp(join(tmpdir(), "ebb-check-all-doc-"));
  try {
    const filePath = join(tempDir, "example.mjs");
    await writeFile(filePath, transpiled.outputText, "utf8");
    return execFileSync(process.execPath, [filePath], { encoding: "utf8" });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("docs/check-all.md runnable SBOM and streaming examples produce the documented output", async () => {
  const markdown = await readFile(resolve("docs/check-all.md"), "utf8");
  const blocks = extractFencedBlocks(markdown);

  // Block 0: import snippet; Block 1 + 2: CycloneDX SBOM ts example + json output;
  // Block 3: valid CheckResult json; Block 4 + 5: Streaming iterable ts example + json output.
  assert.equal(blocks.length, 6, "expected 6 fenced code blocks in docs/check-all.md");

  assert.equal(blocks[0]!.lang, "ts");
  await runExampleBlock(blocks[0]!.code);

  assert.equal(blocks[1]!.lang, "ts");
  assert.equal(blocks[2]!.lang, "json");
  const sbomStdout = await runExampleBlock(blocks[1]!.code);
  const actualSbomOutput = JSON.parse(sbomStdout) as {
    summary: {
      total: number;
      byStatus: Record<string, number>;
      byEvent: Record<string, number>;
      errors: number;
    };
    findingCount: number;
    errors: unknown[];
  };
  const documentedSbomOutput = JSON.parse(blocks[2]!.code) as typeof actualSbomOutput;
  assert.deepEqual(actualSbomOutput, documentedSbomOutput);

  const statusSum = Object.values(actualSbomOutput.summary.byStatus).reduce((sum, count) => sum + count, 0);
  assert.equal(statusSum + actualSbomOutput.summary.errors, actualSbomOutput.summary.total);

  // Verify the documented valid CheckResult entry matches node-sass@9.0.0 in the SBOM.
  assert.equal(blocks[3]!.lang, "json");
  const documentedNodeSassEntry = JSON.parse(blocks[3]!.code) as CheckAllEntry;
  const nodeSassBatch = checkAll([{ purl: "pkg:npm/node-sass@9.0.0", version: "9.0.0" }]);
  assert.deepEqual(nodeSassBatch.results[0], documentedNodeSassEntry);

  // Verify the streaming iterable example output matches verbatim.
  assert.equal(blocks[4]!.lang, "ts");
  assert.equal(blocks[5]!.lang, "json");
  const streamStdout = await runExampleBlock(blocks[4]!.code);
  assert.deepEqual(JSON.parse(streamStdout), JSON.parse(blocks[5]!.code));
});

test("docs/check-all.md documents every CheckAllErrorCode", async () => {
  const markdown = await readFile(resolve("docs/check-all.md"), "utf8");
  const expectedCodes = [...EBB_ERROR_CODES, "invalid-version", "unknown-product", "ambiguous-product", "check-failed"];
  for (const code of expectedCodes) {
    assert.ok(markdown.includes(`\`"${code}"\``), `docs/check-all.md should document CheckAllErrorCode "${code}"`);
  }
});
