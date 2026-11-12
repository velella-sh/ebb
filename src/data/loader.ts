/**
 * Isomorphic data loader interface and built-in loaders.
 */

/**
 * Interface for loading ecosystem data.
 * Implementations can read from Node filesystem, in-memory bundled data,
 * static HTTP API, or custom storage.
 */
export interface DataLoader {
  /** Reads raw data for a relative path or ecosystem name (e.g. "registry/npm.json" or "npm") */
  read(path: string): Promise<unknown>;
  /** Optional synchronous read. If unsupported in this runtime (e.g. pure fetch), may throw or be omitted. */
  readSync?(path: string): unknown;
}

export interface FetchLoaderOptions {
  /** Base URL for static API or hosting endpoint. Defaults to "https://velella.sh/ebb/api/v1". */
  baseUrl?: string;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

function normalizePathToEcosystem(path: string): string {
  return path.replace(/^registry\//, "").replace(/\.json$/, "");
}

/**
 * Creates a DataLoader backed by the Ebb static JSON API.
 * In browser and edge environments, fetches ecosystem rules on demand.
 */
export function createFetchLoader(options: FetchLoaderOptions = {}): DataLoader {
  const baseUrl = (options.baseUrl ?? "https://velella.sh/ebb/api/v1").replace(/\/+$/, "");
  const fetchFn = options.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("No global fetch available. Pass a custom fetch implementation in options.fetch.");
  }

  return {
    async read(path: string): Promise<unknown> {
      const eco = normalizePathToEcosystem(path);
      const primaryUrl = `${baseUrl}/ecosystems/${eco}.json`;
      let res = await fetchFn(primaryUrl);
      if (!res.ok) {
        const fallbackUrl = `${baseUrl}/${eco}.json`;
        res = await fetchFn(fallbackUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch static API ecosystem for ${eco}: HTTP ${res.status}`);
        }
      }
      return await res.json();
    },
  };
}

/**
 * Creates a DataLoader backed by an in-memory map of JSON data or pre-imported data modules.
 * Supports synchronous lookups.
 */
export function createJsonLoader(dataMap: Record<string, unknown>): DataLoader {
  const lookup = (path: string): unknown => {
    const key = normalizePathToEcosystem(path);
    const val = dataMap[key] ?? dataMap[path] ?? dataMap[`registry/${key}.json`];
    if (val === undefined) {
      throw new Error(`Ecosystem data for "${key}" is not registered in JSON loader.`);
    }
    return val;
  };

  return {
    async read(path: string): Promise<unknown> {
      return lookup(path);
    },
    readSync(path: string): unknown {
      return lookup(path);
    },
  };
}
