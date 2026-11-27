/**
 * Example: Reading a Syft JSON document and evaluating EOL lifecycles with Ebb.
 *
 * Usage:
 *   node --experimental-strip-types examples/xeol/check-syft.ts [path/to/syft.json]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAll } from "../../dist/src/index.js";
import { formatXeolJson } from "../../dist/src/xeol/output.js";
import { readSyftDocument } from "../../dist/src/xeol/syft.js";

export function evaluateSyftDocument(syftPath: string) {
  if (!existsSync(syftPath)) {
    throw new Error(`Syft document not found at: ${syftPath}`);
  }

  const raw = readFileSync(syftPath, "utf-8");
  const parsed = readSyftDocument(raw);

  const evaluation = checkAll(
    parsed.items.map((i) => ({ purl: i.purl, version: i.version })),
  );

  const xeolOutput = formatXeolJson(parsed.items, evaluation, parsed.document);

  return {
    totalArtifacts: parsed.totalArtifacts,
    evaluatedItems: parsed.items.length,
    artifactsWithoutPurl: parsed.artifactsWithoutPurl,
    summary: evaluation.summary,
    xeolJson: xeolOutput,
  };
}

// Execute when invoked directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const targetPath = resolve(process.argv[2] ?? resolve(dirname(__filename), "../../tests/fixtures/syft/syft-v1.json"));
  console.log(`Evaluating Syft SBOM at: ${targetPath}\n`);

  const report = evaluateSyftDocument(targetPath);

  console.log(`Artifacts total: ${report.totalArtifacts}`);
  console.log(`Evaluated components: ${report.evaluatedItems}`);
  console.log(`Skipped without purl: ${report.artifactsWithoutPurl}`);
  console.log(`Status breakdown:`, report.summary.byStatus);
  console.log(`\nXeol JSON Output:\n${report.xeolJson}`);
}
