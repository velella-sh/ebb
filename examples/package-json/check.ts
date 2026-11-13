/**
 * Example: Checking dependencies in a package.json file with Ebb.
 *
 * Usage:
 *   node --experimental-strip-types examples/package-json/check.ts [path/to/package.json]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAll, replacementFor } from "../../dist/src/index.js";

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function inspectPackageJson(filePath: string) {
  if (!existsSync(filePath)) {
    throw new Error(`package.json not found at: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  const pkg = JSON.parse(raw) as PackageJson;

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const items = Object.entries(deps).map(([name, verRange]) => {
    // Clean leading semver qualifiers (^, ~, >=, etc.) for lifecycle evaluation
    const version = verRange.replace(/^[^0-9]*/, "");
    return {
      purl: `pkg:npm/${name}`,
      version,
    };
  });

  const evaluation = checkAll(items);

  const findings = evaluation.results
    .map((res, idx) => {
      const original = items[idx]!;
      return {
        ...res,
        purl: original.purl,
        version: original.version,
      };
    })
    .filter((res) => res.status !== "ok");

  return {
    packageJson: pkg,
    total: evaluation.summary.total,
    findings,
    evaluation,
  };
}

// Execute when invoked directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const targetPath = resolve(process.argv[2] ?? resolve(dirname(__filename), "package.json"));
  console.log(`Scanning package.json dependencies at: ${targetPath}\n`);

  const { total, findings, evaluation } = inspectPackageJson(targetPath);

  console.log(`Scanned ${total} dependencies:`);
  console.log(`  - Ok: ${evaluation.summary.byStatus.ok ?? 0}`);
  console.log(`  - Deprecated: ${evaluation.summary.byStatus.deprecated ?? 0}`);
  console.log(`  - Unsupported: ${evaluation.summary.byStatus.unsupported ?? 0}`);
  console.log(`  - End of life: ${evaluation.summary.byStatus["end-of-life"] ?? 0}`);

  if (findings.length > 0) {
    console.log("\n⚠️  Lifecycle warnings:");
    for (const item of findings) {
      const match = item.matches[0];
      const repl = replacementFor(item.purl, item.version) ?? match?.replacement;
      console.log(`\n• ${item.purl}@${item.version} -> ${item.status}`);
      if (match?.ruleId) console.log(`  Rule: ${match.ruleId}`);
      if (repl) console.log(`  Replacement: ${repl}`);
    }
  } else {
    console.log("\n✅ All dependencies are supported and healthy.");
  }
}
