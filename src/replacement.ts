/**
 * `replacementFor(purl, version)`: the suggested replacement for a matched component version.
 */

import { check } from "./check.js";

/**
 * Returns the replacement named by the highest-precedence matching lifecycle rule for
 * `purl` at `version`, or `null` when no matching rule provides a replacement.
 * Delegates rule resolution, ordering, and version matching to {@link check}.
 */
export function replacementFor(purl: string, version: string): string | null {
  const { matches } = check(purl, version);
  const replacement = matches.find(
    (match) => match.replacement !== null && match.replacement.trim() !== "",
  )?.replacement;
  return replacement ?? null;
}
