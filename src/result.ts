/**
 * Stable result-model types shared by `check` and later schema work (#110).
 * Fields may grow; status values are never renamed.
 */

import type { EvidenceSource } from "./domain.js";
import { isIsoDate } from "./registry.js";

/** Schema version for the v1 result model (#110). Never bump without a decision record. */
export const RESULT_SCHEMA_VERSION = 1 as const;

export const resultStatuses = ["ok", "deprecated", "unsupported", "end-of-life", "removed", "scheduled"] as const;

/** A lifecycle verdict, or `ok` when no rule matches. */
export type ResultStatus = (typeof resultStatuses)[number];

/** The event on a matching rule (every status except `ok`). */
export type ResultEvent = Exclude<ResultStatus, "ok">;

/** One rule that matched a checked component version. */
export interface ResultMatch {
  /**
   * Id of the matching registry rule.
   * @stable
   */
  ruleId: string;
  /**
   * Lifecycle event on that rule, in `check`'s short form.
   * @stable
   */
  event: ResultEvent;
  /**
   * Deadline from the rule (`YYYY-MM-DD`), or `null` when undated.
   * @stable
   */
  date: string | null;
  /**
   * Whole UTC days from the result's `asOf` until `date`; `null` when past, undated, or `asOf` is omitted.
   * @experimental
   */
  daysLeft: number | null;
  /**
   * Suggested replacement from the rule, or `null` when none.
   * @stable
   */
  replacement: string | null;
  /**
   * Authoritative evidence pages the rule cites.
   * @stable
   */
  sources: EvidenceSource[];
  /**
   * Date (`YYYY-MM-DD`) a maintainer last reviewed the rule against its sources.
   * @stable
   */
  reviewedAt: string;
}

/** Result of judging one component version against the active lifecycle rules. */
export interface Result {
  /**
   * Fixed version number of this result model (`1`).
   * @stable
   */
  schemaVersion: typeof RESULT_SCHEMA_VERSION;
  /**
   * Primary verdict (`"ok"` when no rule matches; otherwise the most serious matching event).
   * @stable
   */
  status: ResultStatus;
  /**
   * Matching rules ordered by event seriousness then earliest date. Empty when `status` is `"ok"`.
   * @stable
   */
  matches: ResultMatch[];
  /**
   * The version argument exactly as given.
   * @stable
   */
  version: string;
  /**
   * The day `daysLeft` is measured from (`YYYY-MM-DD`), when supplied.
   * Omitted for the clock-free no-`asOf` form; never read from a system clock.
   * @experimental
   */
  asOf?: string;
}

const MS_PER_DAY = 86_400_000;

function requireIsoDate(value: string): void {
  if (!isIsoDate(value)) throw new Error(`"${value}" is not a date (YYYY-MM-DD).`);
}

/**
 * Whole UTC days from `asOf` until a match `date` (`YYYY-MM-DD`).
 * Future dates return a positive integer; past or undated events return `null`.
 * Uses only the two date arguments — never the system clock.
 * Both `asOf` and a non-null `date` must be real calendar days; otherwise this throws.
 */
export function daysLeft(date: string | null, asOf: string): number | null {
  requireIsoDate(asOf);
  if (date === null) return null;
  requireIsoDate(date);
  if (date <= asOf) return null;
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / MS_PER_DAY;
}
