import { type CheckEvent, type CheckResult, type CheckStatus, check } from "./check.js";

/** One component to judge in a batch passed to {@link checkAll}. */
export interface CheckAllItem {
  readonly purl: string;
  readonly version: string;
}

/** Aggregate counts for a batch returned by {@link checkAll}. */
export interface CheckAllSummary {
  /** Total number of input items evaluated in the batch. */
  total: number;
  /** Number of input items with each primary {@link CheckStatus} verdict. */
  byStatus: Record<CheckStatus, number>;
  /** Total matched rules per {@link CheckEvent} across all item `matches` in the batch. */
  byEvent: Record<CheckEvent, number>;
}

/** Batch result returned by {@link checkAll}: positional results paired with summary counts. */
export interface CheckAllResult {
  results: CheckResult[];
  summary: CheckAllSummary;
}

function createSummary(total: number): CheckAllSummary {
  return {
    total,
    byStatus: {
      ok: 0,
      deprecated: 0,
      unsupported: 0,
      "end-of-life": 0,
      removed: 0,
      scheduled: 0,
    },
    byEvent: {
      deprecated: 0,
      unsupported: 0,
      "end-of-life": 0,
      removed: 0,
      scheduled: 0,
    },
  };
}

/**
 * Evaluates a batch while deduplicating identical `(purl, version)` pairs via `evaluate`,
 * always writing each result to the exact input index without sorting and accumulating summary counts.
 * @internal Exported so tests can verify per-pair call counts without module mocks.
 */
export function checkAllWith(
  items: readonly CheckAllItem[],
  evaluate: (purl: string, version: string) => CheckResult,
): CheckAllResult {
  const results = new Array<CheckResult>(items.length);
  const summary = createSummary(items.length);
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
    summary.byStatus[result.status] += 1;
    for (const match of result.matches) {
      summary.byEvent[match.event] += 1;
    }
  }

  return { results, summary };
}

/**
 * Judges each `{ purl, version }` item using {@link check} and returns `{ results, summary }`.
 * Results preserve the exact input order (`results[i]` always corresponds to `items[i]`, never sorted).
 * Identical `(purl, version)` pairs are evaluated once and placed at each matching position.
 * Offline and synchronous; never reads files outside {@link check}'s active data index.
 */
export function checkAll(items: readonly CheckAllItem[]): CheckAllResult {
  return checkAllWith(items, check);
}
