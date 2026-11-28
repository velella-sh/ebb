import { writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundledRouteIds, deriveRuleSlug, routeIdsDigest, type PackedRoutes } from "../../src/site-routes.js";
import { publicRuleRoutes } from "./public-rule-routes.js";

export function unpackSignedCatalogue(source: string): Map<string, string> {
  const routes = new Map<string, string>();
  for (const line of source.split("\n")) {
    const [prefix, ...entries] = line.split(" ");
    for (const entry of entries) {
      const [suffix, slug] = entry.split(":");
      const id = prefix ? `${prefix}.${suffix}` : suffix!;
      routes.set(id, slug ?? deriveRuleSlug(id));
    }
  }
  return routes;
}

export function packRuleRoutes(routes: ReadonlyMap<string, string>, baseline: readonly string[]): PackedRoutes {
  const bundled = new Set(baseline);
  return {
    baseline: routeIdsDigest(baseline),
    excluded: baseline.filter((id) => !routes.has(id)),
    additional: [...routes.keys()].filter((id) => !bundled.has(id)).sort(),
    overrides: Object.fromEntries([...routes].filter(([id, slug]) => deriveRuleSlug(id) !== slug)),
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const baseline = bundledRouteIds(fileURLToPath(new URL("../../../registry", import.meta.url)));
  const packed = packRuleRoutes(unpackSignedCatalogue(publicRuleRoutes), baseline);
  await writeFile(new URL("../../src/public-rule-routes.json", import.meta.url), JSON.stringify(packed) + "\n");
}
