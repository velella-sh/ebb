import { publicRuleRoutes } from "./public-rule-routes.js";

export function deriveRuleSlug(ruleId: string): string {
  return ruleId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let slugs: Map<string, string> | undefined;

/** A public evidence page for IDs present in the signed site snapshot. */
export function canonicalRuleUrl(ruleId: string): string | undefined {
  if (slugs === undefined) {
    slugs = new Map();
    for (const line of publicRuleRoutes.split("\n")) {
      const [prefix, ...entries] = line.split(" ");
      for (const entry of entries) {
        const [suffix, slug] = entry.split(":");
        const id = prefix ? `${prefix}.${suffix}` : suffix!;
        slugs.set(id, slug ?? deriveRuleSlug(id));
      }
    }
  }
  const slug = slugs.get(ruleId);
  return slug === undefined ? undefined : `https://velella.sh/ebb/rules/${slug}/`;
}
