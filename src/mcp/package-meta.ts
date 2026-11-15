import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface InstalledPackageMeta {
  name: string;
  version: string;
}

/**
 * Reads name/version from the installed `@velella/ebb` package.json
 * (the one that shipped with this module), not from a hardcoded constant.
 */
export function readInstalledPackageMeta(fromUrl: string = import.meta.url): InstalledPackageMeta {
  const require = createRequire(fromUrl);
  let pkgPath: string;
  try {
    pkgPath = require.resolve("@velella/ebb/package.json");
  } catch {
    // Fallback when resolution is unavailable (unusual test layouts).
    pkgPath = join(dirname(fileURLToPath(fromUrl)), "..", "..", "..", "package.json");
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string; version?: string };
  if (typeof pkg.name !== "string" || typeof pkg.version !== "string") {
    throw new Error(`Invalid package metadata at ${pkgPath}`);
  }
  return { name: pkg.name, version: pkg.version };
}
