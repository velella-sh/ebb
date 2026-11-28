import type { RegistryV2Rule } from "../../src/registry.js";
import { parseVers, versionScheme } from "../../src/vers.js";
import { directiveData } from "./text.js";

const fields = [
  { field: "status", label: "Release-line status", kind: "status" },
  { field: "event", label: "Lifecycle event", kind: "status" },
  { field: "lifecycleDate", label: "Lifecycle date" },
  { field: "standardSupport", label: "Standard support ends" },
  { field: "extendedSupport", label: "Extended support ends" },
  { field: "replacement", label: "Replacement" },
];

export function supportRules(vers: string, rules: readonly RegistryV2Rule[]) {
  const standard: RegistryV2Rule[] = [];
  const extended: RegistryV2Rule[] = [];
  const line = parseVers(vers);
  const [start, end] = line.constraints;
  const scheme = versionScheme(line.scheme);

  for (const rule of rules) {
    const isExtended = rule.event === "end-of-extended-support";
    const isStandard =
      rule.event === "end-of-support" || rule.event === "end-of-life" || rule.event === "scheduled-end-of-life";
    if (!isStandard && !isExtended) continue;
    const range = parseVers(rule.vers);
    if (range.scheme !== line.scheme) continue;

    const [lower, upper] = range.constraints;
    // Require coverage of the whole release line before assigning a support date to it.
    const coversLine =
      rule.vers === vers ||
      range.all ||
      (start?.comparator === ">=" &&
        end?.comparator === "<" &&
        line.constraints.length === 2 &&
        range.constraints.length === 2 &&
        lower?.comparator === ">=" &&
        upper?.comparator === "<" &&
        scheme.compare(lower.version, start.version) <= 0 &&
        scheme.compare(upper.version, end.version) >= 0);
    if (coversLine) (isExtended ? extended : standard).push(rule);
  }
  return { standard, extended };
}

export function comparisonPages(
  product: { id: string; slug: string; name: string },
  lines: readonly { id: string; slug: string; line: string }[],
  dataVersion: string,
) {
  const ordered = [...lines].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const prefix = `${product.slug}-line-`;
  const suffix = (slug: string) => (slug.startsWith(prefix) ? slug.slice(prefix.length) : slug);
  const pairs = [];
  for (const [index, left] of ordered.entries()) {
    for (const right of ordered.slice(index + 1)) {
      const ids = [left.id, right.id];
      const slug = `${suffix(left.slug)}-vs-${suffix(right.slug)}`;
      pairs.push({
        id: `${product.slug}/${slug}`,
        slug,
        title: `${product.name} ${left.line} vs ${right.line}`,
        summary: `Compare support and evidence for ${product.name} release lines ${left.line} and ${right.line}.`,
        product: product.id,
        productSlug: product.slug,
        dataVersion,
        lines: ids,
        comparison: `::compare{from="release-lines" ids="${directiveData(ids)}" fields="${directiveData(fields)}"}`,
      });
    }
  }
  return pairs;
}
