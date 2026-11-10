/**
 * Stable result-model types shared by `check` and later schema work (#110).
 * Fields may grow; status values are never renamed.
 */

export const resultStatuses = ["ok", "deprecated", "unsupported", "end-of-life", "removed", "scheduled"] as const;

/** A lifecycle verdict, or `ok` when no rule matches. */
export type ResultStatus = (typeof resultStatuses)[number];

const MS_PER_DAY = 86_400_000;

/**
 * Whole UTC days from `asOf` until a match `date` (`YYYY-MM-DD`).
 * Future dates return a positive integer; past or undated events return `null`.
 * Uses only the two date arguments — never the system clock.
 */
export function daysLeft(date: string | null, asOf: string): number | null {
  if (date === null) return null;
  if (date <= asOf) return null;
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / MS_PER_DAY;
}
