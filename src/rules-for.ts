/**
 * `rulesFor(purl)`: every active lifecycle rule registered for a component.
 */

import { resolveAllRulesForIdentity } from "./check.js";
import { normalizePurl, parsePurl, purlIdentity } from "./purl.js";
import { type LifecycleEvent, lifecycleEvents, type RegistryV2Rule } from "./registry.js";
import { parseVersLenient, type VersRange, versionScheme } from "./vers/index.js";

/** A lifecycle rule returned by {@link rulesFor}. */
export type Rule = RegistryV2Rule;

/** Allowed lifecycle event names for filtering {@link rulesFor}. */
export type RuleEvent = LifecycleEvent;

/** Filter options accepted by {@link rulesFor}. */
export interface RulesForOptions {
  event?: RuleEvent | undefined;
}

/** Thrown when {@link rulesFor} receives an invalid filter option such as an unknown lifecycle event. */
export class RulesForError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RulesForError";
  }
}

type RangeStart =
  | { readonly bounded: false }
  | { readonly bounded: true; readonly scheme: string; readonly version: string; readonly inclusive: boolean };

/** Caches sorted copies per immutable index bucket so repeated lookups avoid re-parsing `vers`. */
const sortedBuckets = new WeakMap<readonly Rule[], readonly Rule[]>();

function rangeStart(vers: string): RangeStart {
  const range: VersRange = parseVersLenient(vers);
  if (range.all) return { bounded: false };
  const first = range.constraints.find((constraint) => constraint.comparator !== "!=");
  if (!first || first.comparator === "<" || first.comparator === "<=") return { bounded: false };
  return {
    bounded: true,
    scheme: range.scheme,
    version: first.version,
    inclusive: first.comparator === "=" || first.comparator === ">=",
  };
}

function compareRuleId(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareRangeStart(left: RangeStart, right: RangeStart): number {
  if (!left.bounded && !right.bounded) return 0;
  if (!left.bounded) return -1;
  if (!right.bounded) return 1;

  const leftScheme = versionScheme(left.scheme);
  const rightScheme = versionScheme(right.scheme);
  if (leftScheme === rightScheme) {
    const byVersion = leftScheme.compare(left.version, right.version);
    if (byVersion !== 0) return byVersion;
    if (left.inclusive !== right.inclusive) return left.inclusive ? -1 : 1;
    return 0;
  }
  return left.scheme < right.scheme ? -1 : 1;
}

function sortRulesOldestFirst(bucket: readonly Rule[]): readonly Rule[] {
  const cached = sortedBuckets.get(bucket);
  if (cached !== undefined) return cached;
  const starts = new Map<string, RangeStart>(bucket.map((rule) => [rule.id, rangeStart(rule.vers)]));
  const sorted = [...bucket].sort(
    (left, right) => compareRangeStart(starts.get(left.id)!, starts.get(right.id)!) || compareRuleId(left.id, right.id),
  );
  sortedBuckets.set(bucket, sorted);
  return sorted;
}

function validateEventFilter(event: RuleEvent | undefined): RuleEvent | undefined {
  if (event === undefined) return undefined;
  if (!(lifecycleEvents as readonly string[]).includes(event)) {
    throw new RulesForError(
      `Unknown lifecycle event "${String(event)}". Expected one of: ${lifecycleEvents.join(", ")}.`,
    );
  }
  return event;
}

/**
 * Returns every active lifecycle rule whose component matches `purl`, sorted by version range
 * start (oldest first, ties broken by rule id), or `[]` when none exist.
 * Pass `{ event }` to keep only rules with that {@link LifecycleEvent}; unknown events throw
 * {@link RulesForError}. Normalises `purl` with `src/purl.ts` before lookup; invalid PURLs
 * throw {@link PurlError}. Uses the cached active-data index shared with `check` (offline, synchronous).
 */
export function rulesFor(purl: string, options?: RulesForOptions): Rule[] {
  const identity = purlIdentity(parsePurl(normalizePurl(purl)));
  const event = validateEventFilter(options?.event);
  const bucket = resolveAllRulesForIdentity(identity);
  if (bucket.length === 0) return [];
  const sorted = sortRulesOldestFirst(bucket);
  return event === undefined ? [...sorted] : sorted.filter((rule) => rule.event === event);
}
