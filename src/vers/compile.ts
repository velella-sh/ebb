/**
 * Precompiles and caches VERS ranges on rule objects in memory.
 */

import type { RegistryV2Rule } from "../registry.js";
import { parseVersLenient, type VersRange } from "../vers.js";

export const COMPILED_VERS_RANGE = Symbol.for("ebb.compiledVersRange");

export interface RuleWithCompiledVers extends RegistryV2Rule {
  [COMPILED_VERS_RANGE]?: VersRange;
}

/**
 * Returns the cached compiled VersRange for a rule, parsing it on first access if not yet compiled.
 */
export function getCompiledVers(rule: RegistryV2Rule): VersRange {
  const cached = (rule as RuleWithCompiledVers)[COMPILED_VERS_RANGE];
  if (cached !== undefined) return cached;
  const parsed = parseVersLenient(rule.vers);
  (rule as RuleWithCompiledVers)[COMPILED_VERS_RANGE] = parsed;
  return parsed;
}

/**
 * Precompiles the rule's vers range and caches it on the rule object in memory.
 */
export function compileRuleVers(rule: RegistryV2Rule): VersRange {
  return getCompiledVers(rule);
}

/**
 * Precompiles vers ranges for an array of rules in place.
 */
export function compileRulesVers(rules: readonly RegistryV2Rule[]): void {
  for (const rule of rules) {
    compileRuleVers(rule);
  }
}
