/**
 * Stable result-model types shared by `check` and later schema work (#110).
 * Fields may grow; status values are never renamed.
 */

export const resultStatuses = ["ok", "deprecated", "unsupported", "end-of-life", "removed", "scheduled"] as const;

/** A lifecycle verdict, or `ok` when no rule matches. */
export type ResultStatus = (typeof resultStatuses)[number];
