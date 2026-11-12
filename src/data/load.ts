/**
 * Lazy data loading and preloading for Ebb ecosystems.
 */

import { BUNDLED_ECOSYSTEMS } from "./../data-bundle.js";
import { getActiveData, getActiveDataSync } from "./../data-source.js";
import { validateRegistryV2 } from "./../registry.js";
import type { RegistryV2Rule } from "./../registry.js";
import { parsePurl } from "./../purl.js";
import { compileRulesVers } from "./../vers/compile.js";

const GENERIC_NAME_TO_ECOSYSTEM: Record<string, string> = {
  android: "android",
  cpp: "cpp",
  dart: "dart",
  database: "database",
  deno: "deno",
  dotnet: "dotnet",
  elixir: "elixir",
  go: "go",
  golang: "go",
  ios: "swift",
  java: "java",
  jdk: "java",
  kubernetes: "kubernetes",
  k8s: "kubernetes",
  node: "nodejs",
  nodejs: "nodejs",
  php: "php",
  python: "python",
  ruby: "ruby",
  rust: "rust",
  scala: "scala",
  serverless: "serverless",
  shell: "shell",
  swift: "swift",
  terraform: "terraform",
};

/** Map PURL types to the ecosystem(s) that define them. */
const PURL_TYPE_TO_ECOSYSTEMS: Record<string, readonly string[]> = {
  npm: ["npm", "osv"],
  pypi: ["python", "osv"],
  cargo: ["rust", "osv"],
  golang: ["go", "osv"],
  composer: ["php", "osv"],
  gem: ["ruby", "osv"],
  nuget: ["dotnet", "osv"],
  maven: ["java", "scala", "osv"],
  pub: ["dart", "osv"],
  hex: ["elixir", "osv"],
  swift: ["swift", "osv"],
  conan: ["cpp", "osv"],
  deno: ["deno", "osv"],
  "github-actions": ["github-actions", "osv"],
  docker: ["container", "ci-images", "osv"],
  oci: ["container", "ci-images", "osv"],
  terraform: ["terraform", "osv"],
};

/** In-memory cache of loaded and compiled ecosystem rules. */
const loadedRulesByEcosystem = new Map<string, readonly RegistryV2Rule[]>();

/** In-flight load promises to ensure a single async load per ecosystem. */
const inFlightLoads = new Map<string, Promise<readonly RegistryV2Rule[]>>();

let activeDataSource: unknown;

function checkActiveDataChanged(current: unknown): void {
  if (activeDataSource !== current) {
    loadedRulesByEcosystem.clear();
    inFlightLoads.clear();
    activeDataSource = current;
  }
}

/**
 * Returns which ecosystem(s) likely provide rules for the given PURL or bare product name.
 * If unknown or not a PURL, returns all bundled ecosystems.
 */
export function purlToEcosystems(purlOrName: string): readonly string[] {
  if (!purlOrName.toLowerCase().startsWith("pkg:")) {
    // Bare product name could belong to any ecosystem.
    return BUNDLED_ECOSYSTEMS;
  }
  try {
    const parsed = parsePurl(purlOrName);
    const type = parsed.type.toLowerCase();
    if (type === "generic") {
      const eco = GENERIC_NAME_TO_ECOSYSTEM[parsed.name.toLowerCase()];
      if (eco) return [eco, "osv"];
    }
    const mapped = PURL_TYPE_TO_ECOSYSTEMS[type];
    return mapped ?? BUNDLED_ECOSYSTEMS;
  } catch {
    return BUNDLED_ECOSYSTEMS;
  }
}

/**
 * Checks whether an ecosystem's rules are currently loaded in memory.
 */
export function isEcosystemLoaded(ecosystem: string): boolean {
  return loadedRulesByEcosystem.has(ecosystem);
}

/**
 * Clears in-memory loaded data.
 * @internal Shared with tests and active data re-configuration.
 */
export function clearLoadedEcosystems(): void {
  loadedRulesByEcosystem.clear();
  inFlightLoads.clear();
  activeDataSource = undefined;
}

/**
 * Asynchronously loads and parses an ecosystem's rules.
 * Deduplicates in-flight calls so concurrent requests share a single load.
 */
export function loadEcosystem(ecosystem: string): Promise<readonly RegistryV2Rule[]> {
  const cached = loadedRulesByEcosystem.get(ecosystem);
  if (cached !== undefined) return Promise.resolve(cached);

  const inFlight = inFlightLoads.get(ecosystem);
  if (inFlight !== undefined) return inFlight;

  const promise = (async () => {
    try {
      const activeData = await getActiveData();
      checkActiveDataChanged(activeData);
      // Double-check cache in case another caller populated it while awaiting getActiveData
      const doubleCheck = loadedRulesByEcosystem.get(ecosystem);
      if (doubleCheck !== undefined) return doubleCheck;

      const raw = await activeData.read(`registry/${ecosystem}.json`);
      const validated = validateRegistryV2(raw);
      compileRulesVers(validated.rules);
      loadedRulesByEcosystem.set(ecosystem, validated.rules);
      return validated.rules;
    } finally {
      inFlightLoads.delete(ecosystem);
    }
  })();

  inFlightLoads.set(ecosystem, promise);
  return promise;
}

/**
 * Synchronously loads and parses an ecosystem's rules.
 * Uses cached data if already loaded; otherwise reads synchronously via active data.
 */
export function loadEcosystemSync(ecosystem: string): readonly RegistryV2Rule[] {
  const activeData = getActiveDataSync();
  checkActiveDataChanged(activeData);

  const cached = loadedRulesByEcosystem.get(ecosystem);
  if (cached !== undefined) return cached;

  const raw = activeData.readSync(`registry/${ecosystem}.json`);
  const validated = validateRegistryV2(raw);
  compileRulesVers(validated.rules);
  loadedRulesByEcosystem.set(ecosystem, validated.rules);
  return validated.rules;
}

/**
 * Preloads ecosystem lifecycle data in memory for fast synchronous lookups.
 * Servers should call this at startup (e.g. during server listen).
 *
 * @param ecosystems - Optional list of ecosystem names to preload. If omitted, preloads all ecosystems.
 */
export async function preload(ecosystems?: readonly string[]): Promise<void> {
  const targets = ecosystems ?? BUNDLED_ECOSYSTEMS;
  await Promise.all(targets.map((eco) => loadEcosystem(eco)));
}
