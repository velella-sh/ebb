/**
 * `check(purl, version)`: one answer for a component's lifecycle status.
 * The result type stays small so a later stable model can extend it without breaking callers.
 */

import { readFileSync } from "node:fs";

import { BUNDLED_ECOSYSTEMS } from "./data-bundle.js";
import type { EvidenceSource } from "./domain.js";
import { findPackageFileSync } from "./package-files.js";
import { purlIdentity } from "./purl.js";
import { validateRegistryV2 } from "./registry.js";
import type { RegistryV2Rule } from "./registry.js";

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

/** A rule with only symbol matchers describes an API inside a product, not the package's own lifecycle. */
const isVersionRule = (rule: RegistryV2Rule): boolean =>
  rule.usage === undefined || rule.usage.some((matcher) => matcher.kind !== "symbol");

let rulesByIdentity: Map<string, RegistryV2Rule[]> | undefined;

/** Bundled registries indexed by canonical package identity (`purlIdentity`). Built once, offline. */
function rulesIndex(): Map<string, RegistryV2Rule[]> {
  if (rulesByIdentity !== undefined) return rulesByIdentity;
  const index = new Map<string, RegistryV2Rule[]>();
  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const path = findPackageFileSync(`registry/${ecosystem}.json`, import.meta.url);
    const rules = validateRegistryV2(JSON.parse(readFileSync(path, "utf8"))).rules;
    for (const rule of rules) {
      if (!isVersionRule(rule)) continue;
      const identity = purlIdentity(rule.purl);
      const bucket = index.get(identity);
      if (bucket) bucket.push(rule);
      else index.set(identity, [rule]);
    }
  }
  rulesByIdentity = index;
  return index;
}

/**
 * Every version-level lifecycle rule that could apply to `purl`, before version matching.
 * Parses and normalises the purl; unknown packages return an empty list.
 */
export function resolveCandidateRules(purl: string): readonly RegistryV2Rule[] {
  return rulesIndex().get(purlIdentity(purl)) ?? [];
}

/**
 * Judges `purl` at `version` against the lifecycle rules. Offline; no network.
 * Candidate resolution is ready; version matching is filled in by a later task.
 * Matching will use {@link normalizeVersionInput}; the result keeps the original `version`.
 */
export function check(purl: string, version: string): CheckResult {
  void normalizeVersionInput(version);
  void resolveCandidateRules(purl);
  return { status: "ok", matches: [], version };
}
