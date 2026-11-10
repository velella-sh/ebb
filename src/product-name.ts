/**
 * Shared product-name matching for `lookup` and `check`: alias table, product records
 * from registry rules, and the name → candidates ranking (prefer exact name, then widest).
 */

import { parsePurl } from "./purl.js";
import type { RegistryV2Rule } from "./registry.js";

/** Common names people type that differ from the package URL or product id. */
export const PRODUCT_ALIASES: Record<string, string> = {
  node: "nodejs",
  "node-js": "nodejs",
  nodejs: "nodejs",
  go: "golang",
  golang: "golang",
  py: "python",
  python3: "python",
  net: "dotnet",
  dotnet: "dotnet",
  k8s: "kubernetes",
  postgres: "postgresql",
  psql: "postgresql",
  mongo: "mongodb",
  "ruby-on-rails": "rails",
};

export interface ProductRecord {
  id: string;
  purl: string;
  name: string;
  ecosystems: string[];
  aliases: Set<string>;
  rules: RegistryV2Rule[];
}

/** Fold a human product name so `"Left Pad"` and `"left-pad"` match. */
export const normalizeProductKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Apply {@link PRODUCT_ALIASES} after normalizing. */
export function productNameQuery(name: string): string {
  const normalized = normalizeProductKey(name);
  return PRODUCT_ALIASES[normalized] ?? normalized;
}

function productId(purl: string): string {
  const parsed = parsePurl(purl);
  const parts = [parsed.type, ...(parsed.namespace ? parsed.namespace.split("/") : []), parsed.name];
  return parts
    .join("-")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Group rules into products keyed by purl, with aliases from id, name, and namespace segments. */
export function productsFromRules(rules: readonly RegistryV2Rule[]): ProductRecord[] {
  const products = new Map<string, ProductRecord>();
  for (const rule of rules) {
    let product = products.get(rule.purl);
    if (!product) {
      const parsed = parsePurl(rule.purl);
      product = {
        id: productId(rule.purl),
        purl: rule.purl,
        name: parsed.name,
        ecosystems: [],
        aliases: new Set(),
        rules: [],
      };
      for (const alias of [product.id, parsed.name, ...(parsed.namespace ? parsed.namespace.split("/") : [])]) {
        const normalized = normalizeProductKey(alias);
        if (normalized !== "") product.aliases.add(normalized);
      }
      products.set(rule.purl, product);
    }
    product.rules.push(rule);
    if (!product.ecosystems.includes(rule.ecosystem)) product.ecosystems.push(rule.ecosystem);
  }
  for (const product of products.values()) product.ecosystems.sort();
  return [...products.values()].sort((left, right) => left.purl.localeCompare(right.purl));
}

/**
 * Products matching a bare name after aliasing, ordered like lookup: prefer an exact
 * product name, then more rules, then id. Empty when nothing matches.
 */
export function rankProductsForName(name: string, products: readonly ProductRecord[]): ProductRecord[] {
  const query = productNameQuery(name);
  if (query === "") return [];
  const matches = products.filter((product) => product.aliases.has(query));
  if (matches.length === 0) return [];
  if (matches.length === 1) return matches;
  const named = matches.filter((product) => normalizeProductKey(product.name) === query);
  const candidates = named.length > 0 ? named : matches;
  return [...candidates].sort(
    (left, right) => right.rules.length - left.rules.length || left.id.localeCompare(right.id),
  );
}
