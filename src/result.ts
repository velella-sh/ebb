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
  ruleId: string;
  event: ResultEvent;
  date: string | null;
  /** Whole UTC days from the result's `asOf` until `date`; null when past or undated. */
  daysLeft: number | null;
  replacement: string | null;
  sources: EvidenceSource[];
  /** Date (`YYYY-MM-DD`) a maintainer last reviewed the rule against its sources. */
  reviewedAt: string;
}

/** Result of judging one component version against the active lifecycle rules. */
export interface Result {
  schemaVersion: typeof RESULT_SCHEMA_VERSION;
  status: ResultStatus;
  matches: ResultMatch[];
  /** The version argument exactly as given. */
  version: string;
  /**
   * The day `daysLeft` is measured from (`YYYY-MM-DD`), when supplied.
   * Omitted for the clock-free no-`asOf` form; never read from a system clock.
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
