import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Where downloaded lifecycle data is cached. Imports only Node built-ins, so a command that must start fast can
 * locate the cache without loading the data and signature code.
 */

function resolveHome(explicit?: string): string {
  if (explicit !== undefined) return explicit;
  try {
    return homedir();
  } catch {
    return process.env.HOME ?? process.env.USERPROFILE ?? "";
  }
}

/**
 * Where downloaded data lives: `EBB_DATA_DIR`, else Ebb's folder in the platform's cache directory.
 * @deprecated Import from `@velella/ebb` instead; subpath imports will be removed in 1.0.
 */
export function defaultCacheDirectory(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home?: string,
): string {
  if (env.EBB_DATA_DIR) return env.EBB_DATA_DIR;
  const resolvedHome = resolveHome(home);
  if (platform === "darwin") return join(resolvedHome, "Library", "Caches", "ebb");
  if (platform === "win32") return join(env.LOCALAPPDATA ?? join(resolvedHome, "AppData", "Local"), "ebb", "Cache");
  return join(env.XDG_CACHE_HOME ?? join(resolvedHome, ".cache"), "ebb");
}
