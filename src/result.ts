/**
 * Stable result-model types shared by `check` and later schema work (#110).
 * Fields may grow; status values are never renamed.
 */

import { isIsoDate } from "./registry.js";

export const resultStatuses = ["ok", "deprecated", "unsupported", "end-of-life", "removed", "scheduled"] as const;

/** A lifecycle verdict, or `ok` when no rule matches. */
export type ResultStatus = (typeof resultStatuses)[number];

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
