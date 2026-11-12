/**
 * Lazy data loading and preloading for Ebb ecosystems.
 * Supports configurable data loaders for Node, Browser, Edge, and Workers.
 */

import { BUNDLED_ECOSYSTEMS } from "./ecosystems.js";
import type { DataLoader } from "./loader.js";
import { validateRegistryV2 } from "./../registry.js";
import type { RegistryV2Rule } from "./../registry.js";
import { parsePurl } from "./../purl.js";
import { compileRulesVers } from "./../vers/compile.js";

export { BUNDLED_ECOSYSTEMS };

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

let activeDataLoader: DataLoader | undefined;
let nodeLoaderProvider: (() => DataLoader) | undefined;
let loaderVersion = 0;
let activeDataSource: unknown;

function checkActiveDataChanged(current: unknown): void {
  if (activeDataSource !== current) {
    loadedRulesByEcosystem.clear();
    inFlightLoads.clear();
    activeDataSource = current;
  }
}

/** Registers a Node dynamic loader provider (used in Node runtime to connect active data). */
export function setNodeLoaderProvider(provider: (() => DataLoader) | undefined): void {
  nodeLoaderProvider = provider;
  activeDataLoader = undefined;
  loaderVersion++;
  loadedRulesByEcosystem.clear();
  inFlightLoads.clear();
  activeDataSource = undefined;
}

/** Sets the active data loader for this process or runtime. */
export function setDataLoader(loader: DataLoader): void {
  activeDataLoader = loader;
  loaderVersion++;
  loadedRulesByEcosystem.clear();
  inFlightLoads.clear();
  activeDataSource = undefined;
}

/**
 * Gets the currently active data loader.
 * In browser/worker environments, defaults to the bundled in-memory loader.
 */
export function getDataLoader(): DataLoader {
  if (!activeDataLoader) {
    if (nodeLoaderProvider) {
      activeDataLoader = nodeLoaderProvider();
    } else {
      throw new Error(
        "No DataLoader configured. Call setDataLoader() before querying ecosystem data outside configured entry points.",
      );
    }
  }
  return activeDataLoader;
}

/** Gets the data loader version sequence, incremented on loader changes. */
export function getDataLoaderVersion(): number {
  return loaderVersion;
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
  activeDataLoader = undefined;
  activeDataSource = undefined;
  loaderVersion++;
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
      const loader = getDataLoader();
      checkActiveDataChanged(loader);
      // Double-check cache in case another caller populated it
      const doubleCheck = loadedRulesByEcosystem.get(ecosystem);
      if (doubleCheck !== undefined) return doubleCheck;

      const raw = await loader.read(`registry/${ecosystem}.json`);
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
 * Uses cached data if already loaded; otherwise reads synchronously via active data loader.
 */
export function loadEcosystemSync(ecosystem: string): readonly RegistryV2Rule[] {
  const loader = getDataLoader();
  checkActiveDataChanged(loader);

  const cached = loadedRulesByEcosystem.get(ecosystem);
  if (cached !== undefined) return cached;

  if (typeof loader.readSync !== "function") {
    throw new Error(
      `The configured data loader does not support synchronous loading for ecosystem "${ecosystem}". ` +
        `Call await preload(["${ecosystem}"]) or await loadEcosystem("${ecosystem}") before calling check().`,
    );
  }

  const raw = loader.readSync(`registry/${ecosystem}.json`);
  const validated = validateRegistryV2(raw);
  compileRulesVers(validated.rules);
  loadedRulesByEcosystem.set(ecosystem, validated.rules);
  return validated.rules;
}

/**
 * Preloads ecosystem lifecycle data in memory for fast synchronous lookups.
 * In browser/worker environments using fetchLoader, call this during initialization.
 *
 * @param ecosystems - Optional list of ecosystem names to preload. If omitted, preloads all ecosystems.
 */
export async function preload(ecosystems?: readonly string[]): Promise<void> {
  const targets = ecosystems ?? BUNDLED_ECOSYSTEMS;
  await Promise.all(targets.map((eco) => loadEcosystem(eco)));
}
