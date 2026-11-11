import { type CheckResult, check } from "./check.js";

/** One component to judge in a batch passed to {@link checkAll}. */
export interface CheckAllItem {
  readonly purl: string;
  readonly version: string;
}

/**
 * Judges each `{ purl, version }` item using {@link check} and returns the list of results.
 * Offline and synchronous; never reads files outside {@link check}'s active data index.
 */
export function checkAll(items: readonly CheckAllItem[]): CheckResult[] {
  return items.map((item) => check(item.purl, item.version));
}
