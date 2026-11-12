import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { BUNDLED_ECOSYSTEMS } from "../src/data-bundle.js";
import { validateRegistryV2 } from "../src/registry.js";

export function buildEcosystemModules(root = process.cwd()): void {
  const targetDir = resolve(root, "src/data/ecosystems");
  mkdirSync(targetDir, { recursive: true });

  const manifest: Array<{ ecosystem: string; rulesCount: number; path: string }> = [];

  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const jsonPath = resolve(root, `registry/${ecosystem}.json`);
    const content = JSON.parse(readFileSync(jsonPath, "utf8"));
    const validated = validateRegistryV2(content);

    const tsContent = `// Generated file - do not edit directly. Run npm run build:ecosystems.
import type { RegistryV2, RegistryV2Rule } from "../../registry.js";

export const ecosystem = ${JSON.stringify(ecosystem)} as const;

export const rules: readonly RegistryV2Rule[] = ${JSON.stringify(validated.rules)} as const;

export const data: RegistryV2 = {
  schemaVersion: ${JSON.stringify(validated.schemaVersion)},
  ecosystem: ${JSON.stringify(ecosystem)},
  ${validated.freshness ? `freshness: ${JSON.stringify(validated.freshness)},` : ""}
  rules: [...rules],
};

export default rules;
`;

    const outPath = resolve(targetDir, `${ecosystem}.ts`);
    writeFileSync(outPath, tsContent, "utf8");
    manifest.push({ ecosystem, rulesCount: validated.rules.length, path: `src/data/ecosystems/${ecosystem}.ts` });
  }

  // Also write an index module
  const indexImports = BUNDLED_ECOSYSTEMS.map(
    (eco) =>
      `import { default as ${eco.replace(/-/g, "_")}_rules, data as ${eco.replace(/-/g, "_")}_data } from "./${eco}.js";`,
  ).join("\n");

  const indexMap = BUNDLED_ECOSYSTEMS.map(
    (eco) =>
      `  ${JSON.stringify(eco)}: { rules: ${eco.replace(/-/g, "_")}_rules, data: ${eco.replace(/-/g, "_")}_data },`,
  ).join("\n");

  const indexContent = `// Generated file - do not edit directly. Run npm run build:ecosystems.
import type { RegistryV2, RegistryV2Rule } from "../../registry.js";
${indexImports}

export interface EcosystemModule {
  rules: readonly RegistryV2Rule[];
  data: RegistryV2;
}

export const ecosystems: Readonly<Record<string, EcosystemModule>> = {
${indexMap}
};
`;

  writeFileSync(resolve(targetDir, "index.ts"), indexContent, "utf8");
  console.log(`Generated ${manifest.length} ecosystem data modules in ${targetDir}`);
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("build-ecosystem-modules.ts") || process.argv[1].endsWith("build-ecosystem-modules.js"));

if (isMain) {
  buildEcosystemModules();
}
