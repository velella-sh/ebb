/**
 * `check(purlOrName, version)`: one answer for a component's lifecycle status.
 * The result type stays small so a later stable model can extend it without breaking callers.
 */

import { BUNDLED_ECOSYSTEMS } from "./data-bundle.js";
import type { ActiveData } from "./data-source.js";
import { getActiveDataSync } from "./data-source.js";
import type { EvidenceSource } from "./domain.js";
import { productsFromRules, rankProductsForName } from "./product-name.js";
import type { ProductRecord } from "./product-name.js";
import { normalizePurl, parsePurl, purlIdentity } from "./purl.js";
import { lifecycleEventPrecedence, validateRegistryV2 } from "./registry.js";
import type { LifecycleEvent, RegistryV2Rule } from "./registry.js";
import type { ResultStatus } from "./result.js";
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

/** The event on a matching rule (every status except `ok`). */
export type CheckEvent = Exclude<CheckStatus, "ok">;

/**
 * One rule that matched. Only the fields the issue names; a later result model may add more.
 */
export interface CheckMatch {
  ruleId: string;
  event: CheckEvent;
  date: string | null;
  replacement: string | null;
  sources: EvidenceSource[];
}

/** Status, matches, and the version string the caller passed (not normalized). */
export interface CheckResult {
  status: CheckStatus;
  matches: CheckMatch[];
  /** The version argument exactly as given to `check`. */
  version: string;
}

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
/** Product catalog for bare-name resolution (same shape lookup builds). */
let productCatalog: ProductRecord[] | undefined;
/** The active data the current index was built from; rebuild when {@link configureActiveData} changes it. */
let indexedFrom: ActiveData | undefined;

/**
 * Active registries indexed by canonical package identity (`purlIdentity`), plus the product
 * catalog used for bare names. Uses {@link getActiveDataSync} so downloaded, verified data
 * participates the same way as in `lookup` / `bundledRules()`, while `check` stays synchronous
 * and offline (local files only). The first call can block the event loop while that data is
 * read from disk; later calls reuse the cached index until the active data changes.
 */
function rulesIndex(): Map<string, RegistryV2Rule[]> {
  const data = getActiveDataSync();
  if (rulesByIdentity !== undefined && indexedFrom === data) return rulesByIdentity;
  const index = new Map<string, RegistryV2Rule[]>();
  const allRules: RegistryV2Rule[] = [];
  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const rules = validateRegistryV2(data.readSync(`registry/${ecosystem}.json`)).rules;
    allRules.push(...rules);
    for (const rule of rules) {
      if (!isVersionRule(rule)) continue;
      const identity = purlIdentity(rule.purl);
      const bucket = index.get(identity);
      if (bucket) bucket.push(rule);
      else index.set(identity, [rule]);
    }
  }
  rulesByIdentity = index;
  productCatalog = productsFromRules(allRules);
  indexedFrom = data;
  return index;
}

/**
 * Map a bare product name to its purl with lookup's alias table and ranking. A clear widest
 * match wins; a tie on rule count stays ambiguous and throws.
 */
function resolveProductName(name: string): string {
  rulesIndex();
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
  const identity = purlOrName.toLowerCase().startsWith("pkg:")
    ? // User-typed PURLs may need recommended remediation (e.g. mixed-case qualifier keys).
      purlIdentity(parsePurl(normalizePurl(purlOrName)))
    : purlIdentity(resolveProductName(purlOrName));
  return rulesIndex().get(identity) ?? [];
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
  return versContains(rule.vers, version);
}

/** Reject empty / whitespace-only input before any range compare. */
function requireVersionInput(version: string): string {
  const normalised = normalizeVersionInput(version);
  if (!normalised) throw new VersError(`Invalid version "${version}".`);
  return normalised;
}

function toCheckMatch(rule: RegistryV2Rule): CheckMatch {
  return {
    ruleId: rule.id,
    event: checkEventByLifecycle[rule.event],
    date: rule.deadline ?? null,
    replacement: rule.replacement ?? null,
    sources: rule.sources,
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
 * The result keeps the original `version`.
 */
export function check(purlOrName: string, version: string): CheckResult {
  const candidates = resolveCandidateRules(purlOrName);
  const normalised = requireVersionInput(version);
  const matches = orderMatches(candidates.filter((rule) => ruleMatchesVersion(rule, normalised)).map(toCheckMatch));
  return { status: statusFromMatches(matches), matches, version };
}
