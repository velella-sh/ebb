/**
 * Compatibility mapping from the legacy {@link LookupResult} (`lookupProduct`) shape
 * to the stable v1 {@link Result} model (#119).
 */

import { orderMatches } from "./check.js";
import { BUNDLED_ECOSYSTEMS } from "./data-bundle.js";
import { type ActiveData, getActiveDataSync } from "./data-source.js";
import type { ReplacementItem } from "./domain.js";
import { EbbError } from "./errors.js";
import type { LookupFinding, LookupResult } from "./lookup.js";
import { type LifecycleEvent, validateRegistryV2 } from "./registry.js";
import {
  daysLeft as daysUntil,
  RESULT_SCHEMA_VERSION,
  type Result,
  type ResultEvent,
  type ResultMatch,
  type ResultStatus,
} from "./result.js";
import { confidenceOf, type RuleConfidence } from "./confidence.js";

const eventByLifecycle: Record<LifecycleEvent, ResultEvent> = {
  deprecated: "deprecated",
  "end-of-support": "unsupported",
  "end-of-life": "end-of-life",
  removed: "removed",
  "scheduled-end-of-life": "scheduled",
  "end-of-active-support": "scheduled",
  "end-of-extended-support": "scheduled",
};

interface ActiveRuleMeta {
  reviewedAt: string;
  order: number;
  datePrecision?: "day" | "month";
  confidence?: RuleConfidence;
  replacements?: ReplacementItem[];
}

let ruleMetaById: Map<string, ActiveRuleMeta> | undefined;
let indexedFrom: ActiveData | undefined;

function endOfLifeMonthFromRule(rule: { [key: string]: unknown }): string | undefined {
  for (const [key, value] of Object.entries(rule)) {
    if (!key.startsWith("x-") || typeof value !== "object" || value === null) continue;
    const month = (value as Record<string, unknown>).endOfLifeMonth;
    if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) return month;
  }
  return undefined;
}

function activeRuleMeta(): Map<string, ActiveRuleMeta> {
  const data = getActiveDataSync();
  if (ruleMetaById !== undefined && indexedFrom === data) return ruleMetaById;
  const map = new Map<string, ActiveRuleMeta>();
  let order = 0;
  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const rules = validateRegistryV2(data.readSync(`registry/${ecosystem}.json`)).rules;
    for (const rule of rules) {
      const month = endOfLifeMonthFromRule(rule as unknown as { [key: string]: unknown });
      const meta: ActiveRuleMeta = { reviewedAt: rule.provenance.reviewedAt, order, confidence: confidenceOf(rule) };
      if (month !== undefined) meta.datePrecision = "month";
      if (rule.replacements && rule.replacements.length > 0) meta.replacements = rule.replacements;
      map.set(rule.id, meta);
      order += 1;
    }
  }
  ruleMetaById = map;
  indexedFrom = data;
  return map;
}

function toResultMatch(finding: LookupFinding, meta: ActiveRuleMeta, asOf: string | undefined): ResultMatch {
  const date = finding.deadline ?? null;
  const match: ResultMatch = {
    ruleId: finding.ruleId,
    event: eventByLifecycle[finding.event],
    date,
    daysLeft: asOf === undefined ? null : daysUntil(date, asOf),
    replacement: finding.replacement ?? null,
    sources: finding.sources,
    reviewedAt: meta.reviewedAt,
  };
  if (meta.confidence !== undefined) match.confidence = meta.confidence;
  if (meta.datePrecision !== undefined) match.datePrecision = meta.datePrecision;
  if (meta.replacements !== undefined) match.replacements = meta.replacements;
  return match;
}

function statusFromOrderedMatches(matches: readonly ResultMatch[]): ResultStatus {
  const primary = matches[0];
  return primary === undefined ? "ok" : primary.event;
}

/**
 * Maps a legacy {@link LookupResult} (from `lookupProduct`) into a v1 {@link Result}.
 * Requires a non-empty version on `old` (`old.version ?? old.query.version`), looks up each
 * finding's non-optional `reviewedAt` and tie-break order in active registry data, and
 * orders matches by event seriousness then earliest date to match {@link check}.
 *
 * Pass `asOf` (`YYYY-MM-DD`) to populate `daysLeft` and `Result.asOf`; omit it for the
 * clock-free two-argument contract. Invalid `asOf` values throw.
 */
export function fromLookupProduct(old: LookupResult, asOf?: string): Result {
  // Validate asOf even when findings are empty, matching check().
  if (asOf !== undefined) daysUntil(null, asOf);

  const version = old.version ?? old.query.version;
  if (version === undefined || version.trim().length === 0) {
    throw new EbbError("internal", "Cannot map LookupResult to Result without a non-empty version.");
  }

  const metaById = old.findings.length === 0 ? undefined : activeRuleMeta();
  const entries = old.findings.map((finding, index) => {
    const meta = metaById?.get(finding.ruleId);
    if (meta === undefined) {
      throw new EbbError(
        "internal",
        `Cannot map finding "${finding.ruleId}": missing active rule provenance for reviewedAt.`,
      );
    }
    return { finding, meta, index };
  });

  // Restore registry order on equal (event, date) groups because lookupProduct breaks ties alphabetically.
  entries.sort((left, right) => left.meta.order - right.meta.order || left.index - right.index);

  const matches = orderMatches(entries.map(({ finding, meta }) => toResultMatch(finding, meta, asOf)));
  const extFinding = old.findings.find((f) => f.event === "end-of-extended-support");
  const extendedSupportUntil = extFinding?.deadline;
  let status = statusFromOrderedMatches(matches);
  if (extendedSupportUntil) {
    if (asOf !== undefined) {
      if (asOf >= extendedSupportUntil) {
        status = "end-of-life";
      } else if (status === "end-of-life") {
        status = "unsupported";
      }
    } else if (status === "end-of-life") {
      status = "unsupported";
    }
  }

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    status,
    matches,
    version,
    ...(asOf !== undefined ? { asOf } : {}),
    ...(extendedSupportUntil !== undefined ? { extendedSupportUntil } : {}),
  };
}
