/**
 * `check(purl, version)`: one answer for a component's lifecycle status.
 * The result type stays small so a later stable model can extend it without breaking callers.
 */

import type { EvidenceSource, Severity } from "./domain.js";
import type { LifecycleEvent } from "./registry.js";

export const CHECK_SCHEMA_VERSION = "ebb.check.v1" as const;

/** A lifecycle event, or `ok` when no rule matches the queried purl and version. */
export type CheckStatus = LifecycleEvent | "ok";

/**
 * One rule that matched. Kept to the fields later ordering and reporting need; a later
 * result model may add more without changing the top-level `CheckResult` fields.
 */
export interface CheckMatch {
  ruleId: string;
  event: LifecycleEvent;
  severity: Severity;
  title: string;
  deadline?: string;
  replacement?: string;
  sources: EvidenceSource[];
}

/**
 * The complete answer for one purl and version: status, date (`deadline`), replacement and
 * source evidence, plus the ordered list of matches.
 */
export interface CheckResult {
  schemaVersion: typeof CHECK_SCHEMA_VERSION;
  query: { purl: string; version: string };
  status: CheckStatus;
  /** The date the primary match ends or ended, when it has one. */
  deadline?: string;
  replacement?: string;
  /** Evidence for the primary match; empty when `status` is `ok`. */
  sources: EvidenceSource[];
  matches: CheckMatch[];
}

/**
 * Judges `purl` at `version` against the lifecycle rules. Offline; no network.
 * Candidate resolution and version matching are filled in by later tasks.
 */
export async function check(purl: string, version: string): Promise<CheckResult> {
  return {
    schemaVersion: CHECK_SCHEMA_VERSION,
    query: { purl, version },
    status: "ok",
    sources: [],
    matches: [],
  };
}
