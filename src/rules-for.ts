/**
 * `rulesFor(purl)`: every active lifecycle rule registered for a component.
 */

import { resolveAllRulesForIdentity } from "./check.js";
import { normalizePurl, parsePurl, purlIdentity } from "./purl.js";
import type { RegistryV2Rule } from "./registry.js";

/** A lifecycle rule returned by {@link rulesFor}. */
export type Rule = RegistryV2Rule;

/**
 * Returns every active lifecycle rule whose component matches `purl`, or `[]` when none exist.
 * Normalises `purl` with `src/purl.ts` before lookup; invalid PURLs throw {@link PurlError}.
 * Uses the cached active-data index shared with `check` (offline, synchronous).
 */
export function rulesFor(purl: string): Rule[] {
  const identity = purlIdentity(parsePurl(normalizePurl(purl)));
  return [...resolveAllRulesForIdentity(identity)];
}
