/**
 * `check(purlOrName, version, asOf?)`: one answer for a component's lifecycle status.
 * The result type stays small so a later stable model can extend it without breaking callers.
 */

import { BUNDLED_ECOSYSTEMS } from "./data/ecosystems.js";
import { getDataLoaderVersion, loadEcosystemSync, purlToEcosystems } from "./data/load.js";
import { productsFromRules, rankProductsForName } from "./product-name.js";
import type { ProductRecord } from "./product-name.js";
import { normalizePurl, parsePurl, purlIdentity } from "./purl.js";
import { lifecycleEventPrecedence } from "./registry.js";
import type { LifecycleEvent, RegistryV2Rule } from "./registry.js";
import {
  daysLeft as daysUntil,
  RESULT_SCHEMA_VERSION,
  type Result,
  type ResultEvent,
  type ResultMatch,
  type ResultStatus,
} from "./result.js";
import { getCompiledVers } from "./vers/compile.js";
import { VersError, versContains } from "./vers.js";

/** Thrown when a product name is unknown or matches more than one package. */
export class CheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckError";
  }
}

/** A lifecycle verdict, or `ok` when no rule matches. Same values as {@link ResultStatus}. */
export type CheckStatus = ResultStatus;

/** The event on a matching rule (every status except `ok`). Same values as {@link ResultEvent}. */
export type CheckEvent = ResultEvent;

/** One rule that matched. Same shape as {@link ResultMatch}. */
export type CheckMatch = ResultMatch;

/** Status, matches, and the version string the caller passed (not normalized). Same shape as {@link Result}. */
export type CheckResult = Result;

/**
 * Trims whitespace, drops a leading `v`, and strips build metadata (`+…`)
 * so common spellings compare the same. Does not change `versContains`.
 */
export function normalizeVersionInput(version: string): string {
  let value = version.trim();
  if (value.startsWith("v") || value.startsWith("V")) value = value.slice(1);
  const plus = value.indexOf("+");
  if (plus !== -1) value = value.slice(0, plus);
  return value;
}

/** A rule with only symbol matchers describes an API inside a product, not the package's own lifecycle. */
const isVersionRule = (rule: RegistryV2Rule): boolean =>
  rule.usage === undefined || rule.usage.some((matcher) => matcher.kind !== "symbol");

let rulesByIdentity: Map<string, RegistryV2Rule[]> | undefined;
let allRulesByIdentity: Map<string, RegistryV2Rule[]> | undefined;
const loadedEcosystems = new Set<string>();
const allIndexedRules: RegistryV2Rule[] = [];
/** Product catalog for bare-name resolution (same shape lookup builds). */
let productCatalog: ProductRecord[] | undefined;
/** The active data loader version sequence the current index was built from. */
let indexedVersion = -1;

function pushRule(index: Map<string, RegistryV2Rule[]>, identity: string, rule: RegistryV2Rule): void {
  const bucket = index.get(identity);
  if (bucket) bucket.push(rule);
  else index.set(identity, [rule]);
}

/**
 * Ensures that the requested ecosystems have been loaded and added to the active index.
 * Only reads and validates ecosystems that have not yet been loaded.
 */
function ensureEcosystemsLoaded(ecosystems: Iterable<string>): void {
  const version = getDataLoaderVersion();
  if (indexedVersion !== version) {
    rulesByIdentity = new Map();
    allRulesByIdentity = new Map();
    allIndexedRules.length = 0;
    loadedEcosystems.clear();
    productCatalog = undefined;
    indexedVersion = version;
  }
  rulesByIdentity ??= new Map();
  allRulesByIdentity ??= new Map();

  let addedNew = false;
  for (const ecosystem of ecosystems) {
    if (loadedEcosystems.has(ecosystem)) continue;
    const rules = loadEcosystemSync(ecosystem);
    loadedEcosystems.add(ecosystem);
    addedNew = true;
    for (const rule of rules) {
      allIndexedRules.push(rule);
      const identity = purlIdentity(rule.purl);
      pushRule(allRulesByIdentity, identity, rule);
      if (isVersionRule(rule)) pushRule(rulesByIdentity, identity, rule);
    }
  }
  if (addedNew || productCatalog === undefined) {
    productCatalog = productsFromRules(allIndexedRules);
  }
}

/**
 * Active registries indexed by canonical package identity (`purlIdentity`), plus the product
 * catalog used for bare names. Uses {@link getActiveDataSync} so downloaded, verified data
 * participates the same way as in `lookup` / `bundledRules()`, while `check` stays synchronous
 * and offline (local files only).
 * @internal
 */
export function rulesIndex(): Map<string, RegistryV2Rule[]> {
  ensureEcosystemsLoaded(BUNDLED_ECOSYSTEMS);
  return rulesByIdentity!;
}

/**
 * Returns every rule registered for a canonical `identity` (`purlIdentity`), including
 * symbol-level rules, from the active-data index shared with {@link check}.
 * @internal Shared with `rulesFor`.
 */
export function resolveAllRulesForIdentity(identity: string): readonly RegistryV2Rule[] {
  ensureEcosystemsLoaded(purlToEcosystems(identity));
  return allRulesByIdentity?.get(identity) ?? [];
}

/**
 * Map a bare product name to its purl with lookup's alias table and ranking. A clear widest
 * match wins; a tie on rule count stays ambiguous and throws.
 */
function resolveProductName(name: string): string {
  ensureEcosystemsLoaded(BUNDLED_ECOSYSTEMS);
  const ranked = rankProductsForName(name, productCatalog as ProductRecord[]);
  if (ranked.length === 0) throw new CheckError(`Unknown product "${name}".`);
  const widest = ranked[0] as ProductRecord;
  if (ranked.length === 1 || widest.rules.length > (ranked[1] as ProductRecord).rules.length) {
    return widest.purl;
  }
  throw new CheckError(
    `Ambiguous product name "${name}". Matches: ${ranked.map((product) => `"${product.purl}"`).join(", ")}.`,
  );
}

/**
 * Every version-level lifecycle rule that could apply to `purlOrName`, before version matching.
 * A `pkg:…` input is parsed and normalised like lookup; a bare name uses lookup's alias and
 * ranking helpers. Unknown purls return an empty list; unknown or ambiguous names throw;
 * invalid purls throw.
 */
export function resolveCandidateRules(purlOrName: string): readonly RegistryV2Rule[] {
  if (purlOrName.toLowerCase().startsWith("pkg:")) {
    // User-typed PURLs may need recommended remediation (e.g. mixed-case qualifier keys).
    const identity = purlIdentity(parsePurl(normalizePurl(purlOrName)));
    ensureEcosystemsLoaded(purlToEcosystems(purlOrName));
    return rulesByIdentity?.get(identity) ?? [];
  }
  const identity = purlIdentity(resolveProductName(purlOrName));
  return rulesByIdentity?.get(identity) ?? [];
}

/** Registry events use longer names; the check result keeps the short forms from the signature. */
const checkEventByLifecycle: Record<LifecycleEvent, CheckEvent> = {
  deprecated: "deprecated",
  "end-of-support": "unsupported",
  "end-of-life": "end-of-life",
  removed: "removed",
  "scheduled-end-of-life": "scheduled",
};

/** Most serious event first — shared by `status` and match ordering. */
const statusPrecedence: readonly CheckEvent[] = lifecycleEventPrecedence.map((event) => checkEventByLifecycle[event]);

/**
 * Whether the rule's range contains `version`. Invalid versions and malformed
 * rule `vers` strings throw (same idea as an invalid purl throwing `PurlError`);
 * they must not look like a quiet non-match.
 */
function ruleMatchesVersion(rule: RegistryV2Rule, version: string): boolean {
  return versContains(getCompiledVers(rule), version);
}

/** Reject empty / whitespace-only input before any range compare. */
function requireVersionInput(version: string): string {
  const normalised = normalizeVersionInput(version);
  if (!normalised) throw new VersError(`Invalid version "${version}".`);
  return normalised;
}

function toCheckMatch(rule: RegistryV2Rule, asOf: string | undefined): CheckMatch {
  const date = rule.deadline ?? null;
  return {
    ruleId: rule.id,
    event: checkEventByLifecycle[rule.event],
    date,
    // Without an explicit asOf there is no clock-free countdown; leave daysLeft null.
    daysLeft: asOf === undefined ? null : daysUntil(date, asOf),
    replacement: rule.replacement ?? null,
    sources: rule.sources,
    reviewedAt: rule.provenance.reviewedAt,
  };
}

function statusFromMatches(matches: readonly CheckMatch[]): CheckStatus {
  if (matches.length === 0) return "ok";
  return statusPrecedence.find((event) => matches.some((match) => match.event === event)) ?? matches[0]!.event;
}

/**
 * Most serious event first ({@link lifecycleEventPrecedence}), then earliest
 * date; undated rules sort after dated ones. Equal keys keep input order.
 */
export function orderMatches(matches: readonly CheckMatch[]): CheckMatch[] {
  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => {
      const byEvent = statusPrecedence.indexOf(a.match.event) - statusPrecedence.indexOf(b.match.event);
      if (byEvent !== 0) return byEvent;
      if (a.match.date === null && b.match.date === null) return a.index - b.index;
      if (a.match.date === null) return 1;
      if (b.match.date === null) return -1;
      if (a.match.date < b.match.date) return -1;
      if (a.match.date > b.match.date) return 1;
      return a.index - b.index;
    })
    .map(({ match }) => match);
}

/**
 * Judges a package at `version` against the active lifecycle rules. Offline; no network.
 * Synchronous: reads active data via {@link getActiveDataSync}, so the first call can block
 * the event loop while the data file is read; later calls use the cached index.
 * `purlOrName` may be a package URL or a product name (`"node"`, `"left-pad"`). Bare names
 * use the same alias table and ranking as lookup; a tie on rule count throws {@link CheckError}.
 * Uses the same verified download-or-bundled set as lookup once that data is active.
 * Keeps every candidate whose version range contains the normalised version,
 * ordered by event seriousness then deadline.
 * Unknown purls and known packages with no matching rule return `status: "ok"` and
 * `matches: []`. Unknown or ambiguous product names throw {@link CheckError}.
 * The result keeps the original `version`. Pass `asOf` (`YYYY-MM-DD`) to measure
 * `daysLeft` on each match; omit it to keep the two-argument contract (`daysLeft` is then
 * always `null`, and `asOf` is omitted from the result). An invalid `asOf` throws.
 * @deprecated Import `check` from `@velella/ebb` instead. Subpath imports will be removed in 1.0.
 */
export function check(purlOrName: string, version: string, asOf?: string): CheckResult {
  // Validate asOf even when no rule matches, so callers never see an unchecked day.
  if (asOf !== undefined) daysUntil(null, asOf);
  const candidates = resolveCandidateRules(purlOrName);
  const normalised = requireVersionInput(version);
  const matches = orderMatches(
    candidates.filter((rule) => ruleMatchesVersion(rule, normalised)).map((rule) => toCheckMatch(rule, asOf)),
  );
  return asOf === undefined
    ? { schemaVersion: RESULT_SCHEMA_VERSION, status: statusFromMatches(matches), matches, version }
    : { schemaVersion: RESULT_SCHEMA_VERSION, status: statusFromMatches(matches), matches, version, asOf };
}
