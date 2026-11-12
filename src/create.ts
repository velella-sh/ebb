/**
 * `createEbb({ ecosystems })`: factory to create a scoped Ebb instance
 * with rules for specific ecosystems only.
 */

import {
  type CheckMatch,
  type CheckResult,
  type CheckStatus,
  normalizeVersionInput,
  orderMatches,
} from "./check-core.js";
import { type CheckAllItem, type CheckAllResult, checkAllWith } from "./check-all-core.js";
import { formatReplacement } from "./replacement-core.js";
import { daysLeft as daysUntil, RESULT_SCHEMA_VERSION } from "./result.js";
import { loadEcosystemSync } from "./data/load.js";
import { productsFromRules, rankProductsForName, type ProductRecord } from "./product-name.js";
import { normalizePurl, parsePurl, purlIdentity } from "./purl.js";
import { lifecycleEventPrecedence, type LifecycleEvent, type RegistryV2, type RegistryV2Rule } from "./registry.js";
import type { Rule, RulesForOptions } from "./rules-for-core.js";
import { compileRulesVers, getCompiledVers } from "./vers/compile.js";
import { VersError, versContains } from "./vers.js";

export interface EcosystemDataInput {
  ecosystem?: string;
  rules: readonly RegistryV2Rule[];
  data?: RegistryV2;
}

export type EcosystemInput = string | EcosystemDataInput | readonly RegistryV2Rule[];

export interface CreateEbbOptions {
  /**
   * The ecosystems to load.
   * Can be ecosystem name strings (e.g. `["npm", "python"]`),
   * or imported ecosystem data modules (e.g. `[npmData]`),
   * or raw rule arrays.
   */
  ecosystems: readonly EcosystemInput[];
  /** Default clock date `YYYY-MM-DD` for daysLeft countdowns. */
  asOf?: string;
}

export interface EbbInstance {
  /** The ecosystems loaded in this instance. */
  readonly loadedEcosystems: readonly string[];
  /** Judges a package at `version` against this instance's rules. */
  check(purlOrName: string, version: string, asOf?: string): CheckResult;
  /** Judges an iterable of components against this instance's rules. */
  checkAll(items: Iterable<CheckAllItem>): CheckAllResult;
  /** Returns the recommended replacement component for a deprecated package, or null. */
  replacementFor(purl: string, version: string): string | null;
  /** Returns lifecycle rules that apply to a component. */
  rulesFor(purl: string, options?: RulesForOptions): Rule[];
}

const isVersionRule = (rule: RegistryV2Rule): boolean =>
  rule.usage === undefined || rule.usage.some((matcher) => matcher.kind !== "symbol");

const checkEventByLifecycle: Record<LifecycleEvent, CheckMatch["event"]> = {
  deprecated: "deprecated",
  "end-of-support": "unsupported",
  "end-of-life": "end-of-life",
  removed: "removed",
  "scheduled-end-of-life": "scheduled",
};

const statusPrecedence = lifecycleEventPrecedence.map((event) => checkEventByLifecycle[event]);

function statusFromMatches(matches: readonly CheckMatch[]): CheckStatus {
  if (matches.length === 0) return "ok";
  return statusPrecedence.find((event) => matches.some((match) => match.event === event)) ?? matches[0]!.event;
}

function toCheckMatch(rule: RegistryV2Rule, asOf: string | undefined): CheckMatch {
  const date = rule.deadline ?? null;
  return {
    ruleId: rule.id,
    event: checkEventByLifecycle[rule.event],
    date,
    daysLeft: asOf === undefined ? null : daysUntil(date, asOf),
    replacement: rule.replacement ?? null,
    sources: rule.sources,
    reviewedAt: rule.provenance.reviewedAt,
  };
}

/**
 * Creates an isolated Ebb instance loaded with only the specified ecosystems.
 */
export function createEbb(options: CreateEbbOptions): EbbInstance {
  if (!options || !Array.isArray(options.ecosystems)) {
    throw new TypeError("createEbb requires an options object with an 'ecosystems' array.");
  }

  const loadedNames: string[] = [];
  const allRules: RegistryV2Rule[] = [];
  const versionIndex = new Map<string, RegistryV2Rule[]>();
  const fullIndex = new Map<string, RegistryV2Rule[]>();

  function indexRules(rulesList: readonly RegistryV2Rule[]) {
    const mutableRules = [...rulesList];
    compileRulesVers(mutableRules);
    for (const rule of mutableRules) {
      allRules.push(rule);
      const identity = purlIdentity(rule.purl);
      const fullBucket = fullIndex.get(identity);
      if (fullBucket) fullBucket.push(rule);
      else fullIndex.set(identity, [rule]);

      if (isVersionRule(rule)) {
        const verBucket = versionIndex.get(identity);
        if (verBucket) verBucket.push(rule);
        else versionIndex.set(identity, [rule]);
      }
    }
  }

  for (const input of options.ecosystems) {
    if (typeof input === "string") {
      loadedNames.push(input);
      const rules = loadEcosystemSync(input);
      indexRules(rules);
    } else if (Array.isArray(input)) {
      indexRules(input as RegistryV2Rule[]);
      const first = (input as RegistryV2Rule[])[0];
      if (first?.ecosystem) loadedNames.push(first.ecosystem);
    } else if (input && typeof input === "object" && "rules" in input) {
      const dataInput = input as EcosystemDataInput;
      if (dataInput.ecosystem) loadedNames.push(dataInput.ecosystem);
      indexRules(dataInput.rules);
    }
  }

  const productCatalog: ProductRecord[] = productsFromRules(allRules);

  function resolveCandidateRules(purlOrName: string): readonly RegistryV2Rule[] {
    if (purlOrName.toLowerCase().startsWith("pkg:")) {
      const identity = purlIdentity(parsePurl(normalizePurl(purlOrName)));
      return versionIndex.get(identity) ?? [];
    }
    const ranked = rankProductsForName(purlOrName, productCatalog);
    if (ranked.length === 0) return [];
    const widest = ranked[0] as ProductRecord;
    if (ranked.length === 1 || widest.rules.length > (ranked[1] as ProductRecord).rules.length) {
      return versionIndex.get(purlIdentity(widest.purl)) ?? [];
    }
    return [];
  }

  function instanceCheck(purlOrName: string, version: string, asOf?: string): CheckResult {
    const effectiveAsOf = asOf ?? options.asOf;
    if (effectiveAsOf !== undefined) daysUntil(null, effectiveAsOf);
    const candidates = resolveCandidateRules(purlOrName);
    const normalised = normalizeVersionInput(version);
    if (!normalised) throw new VersError(`Invalid version "${version}".`);

    const matches = orderMatches(
      candidates
        .filter((rule) => versContains(getCompiledVers(rule), normalised))
        .map((rule) => toCheckMatch(rule, effectiveAsOf)),
    );

    return effectiveAsOf === undefined
      ? { schemaVersion: RESULT_SCHEMA_VERSION, status: statusFromMatches(matches), matches, version }
      : {
          schemaVersion: RESULT_SCHEMA_VERSION,
          status: statusFromMatches(matches),
          matches,
          version,
          asOf: effectiveAsOf,
        };
  }

  function instanceRulesFor(purl: string, rulesOptions?: RulesForOptions): Rule[] {
    const identity = purlIdentity(parsePurl(normalizePurl(purl)));
    const rules = fullIndex.get(identity) ?? [];
    if (!rulesOptions?.event) return [...rules];
    return rules.filter((rule) => rule.event === rulesOptions.event);
  }

  function instanceReplacementFor(purl: string, version: string): string | null {
    const { matches } = instanceCheck(purl, version);
    const match = matches.find((entry) => entry.replacement !== null && entry.replacement.trim() !== "");
    if (!match || match.replacement === null) return null;
    const formatted = formatReplacement(purl, match.ruleId, match.replacement);
    return formatted === null || formatted.trim() === "" ? null : formatted;
  }

  function instanceCheckAll(items: Iterable<CheckAllItem>): CheckAllResult {
    return checkAllWith(items, instanceCheck);
  }

  return {
    loadedEcosystems: Object.freeze([...new Set(loadedNames)]),
    check: instanceCheck,
    checkAll: instanceCheckAll,
    replacementFor: instanceReplacementFor,
    rulesFor: instanceRulesFor,
  };
}
