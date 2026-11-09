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

/** Status plus the ordered list of matches. */
export interface CheckResult {
  status: CheckStatus;
  matches: CheckMatch[];
}

/**
 * Judges `purl` at `version` against the lifecycle rules. Offline; no network.
 * Candidate resolution and version matching are filled in by later tasks.
 */
export function check(_purl: string, _version: string): CheckResult {
  return { status: "ok", matches: [] };
}
