/**
 * Example: Inspecting a CycloneDX SBOM JSON file with Ebb.
 *
 * Usage:
 *   node --experimental-strip-types examples/cyclonedx/check-sbom.ts [path/to/bom.json]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAll, replacementFor } from "../../dist/src/index.js";
import { parsePurl } from "../../dist/src/purl.js";

interface CycloneDxComponent {
  name: string;
  version?: string;
  purl?: string;
}

interface CycloneDxBom {
  bomFormat: string;
  specVersion: string;
  components?: CycloneDxComponent[];
}

export function evaluateCycloneDxSbom(bomPath: string) {
  if (!existsSync(bomPath)) {
    throw new Error(`CycloneDX SBOM not found at: ${bomPath}`);
  }

  const raw = readFileSync(bomPath, "utf-8");
  const bom = JSON.parse(raw) as CycloneDxBom;

  if (!Array.isArray(bom.components)) {
    throw new Error("Invalid CycloneDX document: 'components' array is missing");
  }

  const items = bom.components
    .filter((c) => typeof c.purl === "string")
    .map((c) => {
      const parsed = parsePurl(c.purl!);
      const version = c.version ?? parsed.version ?? "";
      return {
        purl: c.purl!,
        version,
        name: c.name,
      };
    });

  const evaluation = checkAll(
    items.map((i) => ({ purl: i.purl, version: i.version })),
  );

  const findings = evaluation.results
    .map((res, idx) => ({
      ...res,
      purl: items[idx]!.purl,
      name: items[idx]!.name,
      version: items[idx]!.version,
    }))
    .filter((res) => res.status !== "ok");

  return {
    bomFormat: bom.bomFormat,
    specVersion: bom.specVersion,
    totalComponents: items.length,
    findings,
    summary: evaluation.summary,
  };
}

// Execute when invoked directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const targetPath = resolve(process.argv[2] ?? resolve(dirname(__filename), "bom.json"));
  console.log(`Evaluating CycloneDX SBOM at: ${targetPath}\n`);

  const report = evaluateCycloneDxSbom(targetPath);

  console.log(`Format: ${report.bomFormat} v${report.specVersion}`);
  console.log(`Components evaluated: ${report.totalComponents}`);
  console.log(`Status breakdown:`, report.summary.byStatus);

  if (report.findings.length > 0) {
    console.log("\n⚠️  Identified End-of-Life & Deprecated Components:");
    for (const item of report.findings) {
      const match = item.matches[0];
      const repl = replacementFor(item.purl, item.version) ?? match?.replacement;
      console.log(`\n• ${item.name} (${item.purl}) -> ${item.status.toUpperCase()}`);
      if (match?.ruleId) console.log(`  Rule: ${match.ruleId}`);
      if (repl) console.log(`  Replacement: ${repl}`);
    }
  } else {
    console.log("\n✅ All components in the SBOM are healthy.");
  }
}
