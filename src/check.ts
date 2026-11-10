/**
 * `check(purl, version)`: one answer for a component's lifecycle status.
 * The result type stays small so a later stable model can extend it without breaking callers.
 */

import type { EvidenceSource } from "./domain.js";

/** A lifecycle verdict, or `ok` when no rule matches. */
export type CheckStatus = "ok" | "deprecated" | "unsupported" | "end-of-life" | "removed" | "scheduled";

/** The event on a matching rule (every status except `ok`). */
export type CheckEvent = Exclude<CheckStatus, "ok">;

/**
 * One rule that matched. Only the fields the issue names; a later result model may add more.
 */
export interface CheckMatch {
  ruleId: string;
  event: CheckEvent;
  date: string | null;
  replacement: string | null;
  sources: EvidenceSource[];
}

/** Status, matches, and the version string the caller passed (not normalized). */
export interface CheckResult {
  status: CheckStatus;
  matches: CheckMatch[];
  /** The version argument exactly as given to `check`. */
  version: string;
}

/**
 * Trims whitespace, drops a leading `v`, and strips build metadata (`+…`)
 * so common spellings compare the same. Does not change `versContains`.
 */
export function normalizeVersionInput(version: string): string {
  let value = version.trim();
  if (value.startsWith("v") || value.startsWith("V")) value = value.slice(1);
  const plus = value.indexOf("+");
  if (plus !== -1) value = value.slice(0, plus);
  return value;
}

/**
 * Judges `purl` at `version` against the lifecycle rules. Offline; no network.
 * Candidate resolution and version matching are filled in by later tasks.
 * Matching will use {@link normalizeVersionInput}; the result keeps the original `version`.
 */
export function check(_purl: string, version: string): CheckResult {
  // Ensure the normalized form is computed on every call; matching lands in a later issue.
  void normalizeVersionInput(version);
  return { status: "ok", matches: [], version };
}
