import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUNDLED_ECOSYSTEMS } from "./data/ecosystems.js";
import { findPackageFileSync } from "./package-files.js";

export function deriveRuleSlug(ruleId: string): string {
  return ruleId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface PackedRoutes {
  baseline: string;
  excluded: string[];
  additional: string[];
  overrides: Record<string, string>;
}

/** Use the installed registry, never an active cache or an external loader, as the compression dictionary. */
export function bundledRouteIds(directory: string): string[] {
  const ids = new Set<string>();
  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const data = JSON.parse(readFileSync(join(directory, ecosystem + ".json"), "utf8")) as { rules: { id: string }[] };
    for (const { id } of data.rules) ids.add(id);
  }
  return [...ids].sort();
}

export const routeIdsDigest = (ids: readonly string[]) => createHash("sha256").update(ids.join("\n")).digest("hex");

export function unpackRuleRoutes(packed: PackedRoutes, baseline: readonly string[]): Map<string, string> {
  if (routeIdsDigest(baseline) !== packed.baseline)
    throw new Error("Ebb's bundled rule route catalogue does not match its dictionary.");
  const excluded = new Set(packed.excluded);
  return new Map(
    [...baseline.filter((id) => !excluded.has(id)), ...packed.additional].map((id) => [
      id,
      Object.hasOwn(packed.overrides, id) ? packed.overrides[id]! : deriveRuleSlug(id),
    ]),
  );
}

let slugs: Map<string, string> | undefined;

/** A public evidence page for IDs present in the signed site snapshot. */
export function canonicalRuleUrl(ruleId: string): string | undefined {
  if (!slugs) {
    const packed = JSON.parse(
      readFileSync(new URL("./public-rule-routes.json", import.meta.url), "utf8"),
    ) as PackedRoutes;
    slugs = unpackRuleRoutes(packed, bundledRouteIds(findPackageFileSync("registry", import.meta.url)));
  }
  const slug = slugs.get(ruleId);
  return slug === undefined ? undefined : `https://velella.sh/ebb/rules/${slug}/`;
}
