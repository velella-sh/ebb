import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { DEFAULT_MAX_REVIEW_AGE_DAYS, type RegistryV2 } from "../src/registry.js";
import { stale, staleBadgeEndpoint } from "../src/stale.js";

export interface EndpointBadge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

export async function generateDataBadges(
  registryDir: string = "registry",
  outputDir: string = "coverage",
  asOf: string = new Date().toISOString().slice(0, 10),
): Promise<{ totalRules: number; staleRules: number; fileCount: number }> {
  const files = (await readdir(registryDir)).filter((f) => f.endsWith(".json") && f !== "sources.lock.json");
  const registries: RegistryV2[] = [];
  let totalRules = 0;

  for (const file of files) {
    try {
      const content = await readFile(join(registryDir, file), "utf-8");
      const parsed = JSON.parse(content) as RegistryV2;
      if (Array.isArray(parsed.rules)) {
        totalRules += parsed.rules.length;
        registries.push(parsed);
      }
    } catch {
      // Ignore non-registry JSON
    }
  }

  await mkdir(outputDir, { recursive: true });

  const rulesBadge: EndpointBadge = {
    schemaVersion: 1,
    label: "rules",
    message: `${totalRules}`,
    color: "3F6E66",
  };
  await writeFile(join(outputDir, "rules.json"), `${JSON.stringify(rulesBadge, null, 2)}\n`);

  const staleResult = stale({ asOf, registries });
  const staleBadge = staleBadgeEndpoint(staleResult);
  await writeFile(join(outputDir, "stale-rules.json"), `${JSON.stringify(staleBadge, null, 2)}\n`);

  console.log(`Generated rules badge: ${totalRules} rules from ${files.length} files.`);
  console.log(
    `Generated stale-rules badge: ${staleResult.counts.stale} stale (default window ${DEFAULT_MAX_REVIEW_AGE_DAYS}d or per-registry).`,
  );

  return { totalRules, staleRules: staleResult.counts.stale, fileCount: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDataBadges().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
