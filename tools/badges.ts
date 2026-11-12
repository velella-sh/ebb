import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface EndpointBadge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

export async function generateDataBadges(
  registryDir: string = "registry",
  outputDir: string = "coverage",
): Promise<{ totalRules: number; fileCount: number }> {
  const files = (await readdir(registryDir)).filter((f) => f.endsWith(".json") && f !== "sources.lock.json");
  let totalRules = 0;

  for (const file of files) {
    try {
      const content = await readFile(join(registryDir, file), "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.rules)) {
        totalRules += parsed.rules.length;
      }
    } catch {
      // Ignore non-registry JSON
    }
  }

  const rulesBadge: EndpointBadge = {
    schemaVersion: 1,
    label: "rules",
    message: `${totalRules}`,
    color: "3F6E66",
  };

  await writeFile(join(outputDir, "rules.json"), `${JSON.stringify(rulesBadge, null, 2)}\n`);
  console.log(`Generated rules badge: ${totalRules} rules from ${files.length} files.`);

  return { totalRules, fileCount: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDataBadges().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
