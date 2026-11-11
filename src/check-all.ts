import { type CheckResult, check } from "./check.js";

/** One component to judge in a batch passed to {@link checkAll}. */
export interface CheckAllItem {
  readonly purl: string;
  readonly version: string;
}

/**
 * Evaluates a batch while deduplicating identical `(purl, version)` pairs via `evaluate`,
 * always writing each result to the exact input index without sorting.
 * @internal Exported so tests can verify per-pair call counts without module mocks.
 */
export function checkAllWith(
  items: readonly CheckAllItem[],
  evaluate: (purl: string, version: string) => CheckResult,
): CheckResult[] {
  const results = new Array<CheckResult>(items.length);
  const cache = new Map<string, Map<string, CheckResult>>();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    let byVersion = cache.get(item.purl);
    let result = byVersion?.get(item.version);
    if (result === undefined) {
      result = evaluate(item.purl, item.version);
      if (byVersion === undefined) {
        byVersion = new Map<string, CheckResult>();
        cache.set(item.purl, byVersion);
      }
      byVersion.set(item.version, result);
    }
    results[index] = result;
  }

  return results;
}

/**
 * Judges each `{ purl, version }` item using {@link check} and returns the results in the exact
 * input order (`results[i]` always corresponds to `items[i]`, never sorted).
 * Identical `(purl, version)` pairs are evaluated once and the result is placed at each matching position.
 * Offline and synchronous; never reads files outside {@link check}'s active data index.
 */
export function checkAll(items: readonly CheckAllItem[]): CheckResult[] {
  return checkAllWith(items, check);
}
