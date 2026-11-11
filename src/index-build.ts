/**
 * Builds fast PURL identity indexes for rule and product lookups without linear scanning.
 */

import { normalizePurl, parsePurl, purlIdentity } from "./purl.js";
import type { ProductRecord } from "./product-name.js";
import type { RegistryV2Rule } from "./registry.js";

/** Map from canonical purl identity to rules. */
export type PurlRuleMap = Map<string, RegistryV2Rule[]>;

/** Map from canonical purl identity to product records. */
export type PurlProductMap = Map<string, ProductRecord>;

/**
 * Builds a map from normalised purl identity to rules at load time.
 */
export function buildPurlIndex(rules: readonly RegistryV2Rule[]): PurlRuleMap {
  const map: PurlRuleMap = new Map();
  for (const rule of rules) {
    const identity = purlIdentity(rule.purl);
    const bucket = map.get(identity);
    if (bucket) {
      bucket.push(rule);
    } else {
      map.set(identity, [rule]);
    }
  }
  return map;
}

/**
 * Builds a map from normalised purl identity to products at load time.
 */
export function buildProductPurlIndex(products: readonly ProductRecord[]): PurlProductMap {
  const map: PurlProductMap = new Map();
  for (const product of products) {
    const identity = purlIdentity(product.purl);
    map.set(identity, product);
  }
  return map;
}

/**
 * Normalises a package URL or identity string and queries a PURL index.
 */
export function lookupByPurl<T>(index: ReadonlyMap<string, T>, purlOrName: string): T | undefined {
  let identity: string;
  try {
    const parsed = parsePurl(normalizePurl(purlOrName));
    identity = purlIdentity(parsed.type === "githubactions" ? { ...parsed, type: "github" } : parsed);
  } catch {
    return undefined;
  }
  return index.get(identity);
}
