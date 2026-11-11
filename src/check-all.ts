import { CheckError, type CheckEvent, type CheckResult, type CheckStatus, check } from "./check.js";
import { EbbError, type EbbErrorCode } from "./errors.js";
import { VersError } from "./vers.js";

/** One component to judge in a batch passed to {@link checkAll}. */
export interface CheckAllItem {
  readonly purl: string;
  readonly version: string;
}

/** Error codes recorded on a {@link CheckAllError} entry when judging one item fails. */
export type CheckAllErrorCode =
  | EbbErrorCode
  | "invalid-version"
  | "unknown-product"
  | "ambiguous-product"
  | "check-failed";

/** Positional error entry produced in {@link CheckAllResult.results} when checking one item fails. */
export interface CheckAllError {
  readonly status: "error";
  /** Zero-based position of the failing item in the input batch. */
  readonly index: number;
  readonly code: CheckAllErrorCode;
  readonly message: string;
}

/** One item outcome in {@link CheckAllResult.results}: either a lifecycle {@link CheckResult} or a {@link CheckAllError}. */
export type CheckAllEntry = CheckResult | CheckAllError;

/** Type guard narrowing a {@link CheckAllEntry} to {@link CheckAllError}. */
export function isCheckAllError(entry: CheckAllEntry): entry is CheckAllError {
  return entry.status === "error";
}

/** Aggregate counts for a batch returned by {@link checkAll}. */
export interface CheckAllSummary {
  /** Total number of input items evaluated in the batch. */
  total: number;
  /** Number of valid input items with each primary {@link CheckStatus} verdict. */
  byStatus: Record<CheckStatus, number>;
  /** Total matched rules per {@link CheckEvent} across all valid item `matches` in the batch. */
  byEvent: Record<CheckEvent, number>;
  /** Number of input items that produced a {@link CheckAllError} entry. */
  errors: number;
}

/** Batch result returned by {@link checkAll}: positional entries paired with summary counts. */
export interface CheckAllResult {
  results: CheckAllEntry[];
  summary: CheckAllSummary;
}

class CachedFailure {
  constructor(
    readonly code: CheckAllErrorCode,
    readonly message: string,
  ) {}
}

type CachedOutcome = CheckResult | CachedFailure;

class SingleEntry {
  constructor(
    readonly version: string,
    readonly outcome: CachedOutcome,
  ) {}
}

type CacheSlot = SingleEntry | Map<string, CachedOutcome>;

function classifyItemError(error: unknown): { code: CheckAllErrorCode; message: string } {
  if (error instanceof EbbError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof VersError) {
    return { code: "invalid-version", message: error.message };
  }
  if (error instanceof CheckError) {
    const code = error.message.startsWith("Ambiguous") ? "ambiguous-product" : "unknown-product";
    return { code, message: error.message };
  }
  return {
    code: "check-failed",
    message: error instanceof Error ? error.message : String(error),
  };
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
    errors: 0,
  };
}

function runItemEvaluation(
  purl: string,
  version: string,
  evaluate: (purl: string, version: string) => CheckResult,
): CachedOutcome {
  try {
    return evaluate(purl, version);
  } catch (error) {
    const classified = classifyItemError(error);
    return new CachedFailure(classified.code, classified.message);
  }
}

function evaluatePair(
  cache: Map<string, CacheSlot>,
  purl: string,
  version: string,
  evaluate: (purl: string, version: string) => CheckResult,
): CachedOutcome {
  const existing = cache.get(purl);
  if (existing === undefined) {
    const outcome = runItemEvaluation(purl, version, evaluate);
    cache.set(purl, new SingleEntry(version, outcome));
    return outcome;
  }
  if (existing instanceof SingleEntry) {
    if (existing.version === version) return existing.outcome;
    const outcome = runItemEvaluation(purl, version, evaluate);
    cache.set(
      purl,
      new Map<string, CachedOutcome>([
        [existing.version, existing.outcome],
        [version, outcome],
      ]),
    );
    return outcome;
  }
  let outcome = existing.get(version);
  if (outcome === undefined) {
    outcome = runItemEvaluation(purl, version, evaluate);
    existing.set(version, outcome);
  }
  return outcome;
}

function recordOutcome(summary: CheckAllSummary, outcome: CachedOutcome, index: number): CheckAllEntry {
  if (outcome instanceof CachedFailure) {
    summary.errors += 1;
    return {
      status: "error",
      index,
      code: outcome.code,
      message: outcome.message,
    };
  }
  summary.byStatus[outcome.status] += 1;
  for (const match of outcome.matches) {
    summary.byEvent[match.event] += 1;
  }
  return outcome;
}

/**
 * Evaluates a batch while deduplicating identical `(purl, version)` pairs via `evaluate`,
 * always writing each result (or error entry) to the exact input index without sorting and accumulating summary counts.
 * @internal Exported so tests can verify per-pair call counts without module mocks.
 */
export function checkAllWith(
  items: Iterable<CheckAllItem>,
  evaluate: (purl: string, version: string) => CheckResult,
): CheckAllResult {
  const cache = new Map<string, CacheSlot>();

  if (Array.isArray(items)) {
    const list: readonly CheckAllItem[] = items;
    const results = new Array<CheckAllEntry>(list.length);
    const summary = createSummary(list.length);
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index]!;
      const outcome = evaluatePair(cache, item.purl, item.version, evaluate);
      results[index] = recordOutcome(summary, outcome, index);
    }
    return { results, summary };
  }

  const results: CheckAllEntry[] = [];
  const summary = createSummary(0);
  let index = 0;
  for (const item of items) {
    const outcome = evaluatePair(cache, item.purl, item.version, evaluate);
    results.push(recordOutcome(summary, outcome, index));
    index += 1;
  }
  summary.total = index;
  return { results, summary };
}

/**
 * Judges each `{ purl, version }` item using {@link check} and returns `{ results, summary }`.
 * Accepts any iterable (arrays use a pre-sized indexed path; other iterables stream in a single pass).
 * Results preserve the exact input order (`results[i]` always corresponds to `items[i]`, never sorted).
 * Identical `(purl, version)` pairs are evaluated once and placed at each matching position.
 * Invalid items produce a {@link CheckAllError} entry (`status: "error"`) with their index and error code
 * instead of failing the rest of the batch.
 * Offline and synchronous; never reads files outside {@link check}'s active data index.
 */
export function checkAll(items: Iterable<CheckAllItem>): CheckAllResult {
  return checkAllWith(items, check);
}
