/**
 * `asOf(date)`: scoped client to evaluate lifecycle rules as of a past or future calendar date.
 * Replays rules observed on or before `date`, and judges scheduled events relative to `date`.
 */

import {
  type CheckEvent,
  type CheckMatch,
  type CheckResult,
  normalizeVersionInput,
  orderMatches,
  resolveCandidateRules,
  statusFromMatches,
} from "./check-core.js";
import { type CheckAllItem, type CheckAllResult, checkAllWith } from "./check-all-core.js";
import { EbbError } from "./errors.js";
import { isIsoDate, type LifecycleEvent, type RegistryV2Rule } from "./registry.js";
import { daysLeft as daysUntil, RESULT_SCHEMA_VERSION } from "./result.js";
import { type Rule, type RulesForOptions, rulesFor } from "./rules-for-core.js";
import { type UpcomingOptions, type UpcomingResult, upcoming } from "./upcoming.js";
import { type SourcesOfResult, sourcesOf } from "./sources-of.js";
import { VersError, versContains } from "./vers.js";
import { getCompiledVers } from "./vers/compile.js";

// Legacy types preserved for subpath backwards compatibility
import type { LifecycleScan } from "./domain.js";

const REACHED_SEVERITY = "high" as const;

export interface AsOfOptions {
  /** Custom list of rules to inspect instead of reading active registry data. */
  readonly rules?: readonly Rule[] | undefined;
}

export interface AsOfClient {
  /** The reference date (YYYY-MM-DD) this client evaluates against. */
  readonly asOf: string;
  /** Judges a package at `version` against lifecycle rules as of this date. */
  check(purlOrName: string, version: string): CheckResult;
  /** Judges an iterable of components against lifecycle rules as of this date. */
  checkAll(items: Iterable<CheckAllItem>): CheckAllResult;
  /** Returns lifecycle rules that apply to a component as of this date. */
  rulesFor(purl: string, options?: RulesForOptions): Rule[];
  /** Returns recommended replacement for a deprecated package as of this date, or null. */
  replacementFor(purl: string, version: string): string | null;
  /** Returns upcoming lifecycle events starting from this date. */
  upcoming(options?: Omit<UpcomingOptions, "asOf">): UpcomingResult;
  /** Returns evidence sources and review provenance for a rule as of this date. */
  sourcesOf(ruleId: string): SourcesOfResult;
}

function requireIsoDate(value: string): void {
  if (!isIsoDate(value)) {
    throw new EbbError("invalid-date", `"${value}" is not a date (YYYY-MM-DD).`);
  }
}

function mapLifecycleToCheckEvent(event: LifecycleEvent): CheckEvent {
  switch (event) {
    case "deprecated":
      return "deprecated";
    case "end-of-support":
      return "unsupported";
    case "end-of-life":
      return "end-of-life";
    case "removed":
      return "removed";
    case "scheduled-end-of-life":
      return "scheduled";
  }
}

function filterCandidatesFromRules(purlOrName: string, rules: readonly RegistryV2Rule[]): readonly RegistryV2Rule[] {
  if (purlOrName.toLowerCase().startsWith("pkg:")) {
    const atIdx = purlOrName.lastIndexOf("@");
    const basePurl = atIdx !== -1 ? purlOrName.slice(0, atIdx) : purlOrName;
    return rules.filter((r) => r.purl === basePurl || purlOrName.startsWith(`${r.purl}@`));
  }
  return rules.filter((r) => r.ecosystem === purlOrName || r.purl.includes(`/${purlOrName}`));
}

function filterRulesFromCustom(purl: string, rules: readonly RegistryV2Rule[]): Rule[] {
  const atIdx = purl.lastIndexOf("@");
  const basePurl = atIdx !== -1 ? purl.slice(0, atIdx) : purl;
  return rules.filter((r) => r.purl === basePurl || purl.startsWith(`${r.purl}@`));
}

/**
 * Creates a scoped client to query Ebb's knowledge as of `date` (YYYY-MM-DD in UTC).
 * - Hides rules observed after `date` (`provenance.observedAt > date`).
 * - Judges scheduled events relative to `date`: scheduled events whose deadline is
 *   on or before `date` are evaluated as ended (`end-of-life`).
 * - Replays deterministic verdicts for past dates and allows future dates for planning.
 */
export function asOf(date: string, options?: AsOfOptions): AsOfClient {
  requireIsoDate(date);

  const customRules = options?.rules;

  function evaluateCheck(purlOrName: string, version: string): CheckResult {
    const candidates =
      customRules !== undefined
        ? filterCandidatesFromRules(purlOrName, customRules)
        : resolveCandidateRules(purlOrName);

    const normalised = normalizeVersionInput(version);
    if (!normalised) throw new VersError(`Invalid version "${version}".`);

    // Hide rules observed after date
    const visible = candidates.filter((rule) => rule.provenance.observedAt <= date);

    const matches: CheckMatch[] = [];
    for (const rule of visible) {
      if (!versContains(getCompiledVers(rule), normalised)) continue;

      const isScheduled = rule.event === "scheduled-end-of-life";
      const deadlineReached = isScheduled && rule.deadline !== undefined && rule.deadline <= date;

      const event: CheckEvent = deadlineReached ? "end-of-life" : mapLifecycleToCheckEvent(rule.event);

      const ruleDate = rule.deadline ?? null;
      const days = ruleDate === null ? null : daysUntil(ruleDate, date);

      matches.push({
        ruleId: rule.id,
        event,
        date: ruleDate,
        daysLeft: days,
        replacement: rule.replacement ?? null,
        sources: rule.sources,
        reviewedAt: rule.provenance.reviewedAt,
      });
    }

    const ordered = orderMatches(matches);
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      status: statusFromMatches(ordered),
      matches: ordered,
      version,
      asOf: date,
    };
  }

  function evaluateCheckAll(items: Iterable<CheckAllItem>): CheckAllResult {
    return checkAllWith(items, (purl, version) => evaluateCheck(purl, version));
  }

  function evaluateRulesFor(purl: string, rulesForOpts?: RulesForOptions): Rule[] {
    const allRules = customRules !== undefined ? filterRulesFromCustom(purl, customRules) : rulesFor(purl);

    const visible = allRules.filter((rule) => rule.provenance.observedAt <= date);

    const adjusted = visible.map((rule) => {
      if (rule.event === "scheduled-end-of-life" && rule.deadline !== undefined && rule.deadline <= date) {
        return {
          ...rule,
          event: "end-of-life" as const,
          severity: REACHED_SEVERITY,
        };
      }
      return rule;
    });

    const eventFilter = rulesForOpts?.event;
    if (eventFilter === undefined) return adjusted;
    return adjusted.filter((rule) => rule.event === eventFilter);
  }

  function evaluateReplacementFor(purl: string, version: string): string | null {
    const res = evaluateCheck(purl, version);
    const match = res.matches.find((m) => m.replacement !== null);
    return match?.replacement ?? null;
  }

  function evaluateUpcoming(upcomingOpts?: Omit<UpcomingOptions, "asOf">): UpcomingResult {
    return upcoming({
      ...upcomingOpts,
      asOf: date,
      rules: customRules,
    });
  }

  return {
    asOf: date,
    check: evaluateCheck,
    checkAll: evaluateCheckAll,
    rulesFor: evaluateRulesFor,
    replacementFor: evaluateReplacementFor,
    upcoming: evaluateUpcoming,
    sourcesOf: (ruleId: string) => sourcesOf(ruleId, { asOf: date, rules: customRules }),
  };
}

/**
 * Projects a scan onto a future day: each announced end of life whose deadline is on or before `asOf` is
 * reported as the ended line it will be, at end-of-life severity. Finding identity never changes, so
 * baselines still match. The scan itself stays clock-free; this is an explicit, deterministic step.
 * @deprecated Import from `@velella/ebb` instead; subpath imports will be removed in 1.0.
 */
export async function applyAsOf<Scan extends LifecycleScan>(
  result: Scan,
  asOfDate: string,
  rules?: readonly RegistryV2Rule[] | Promise<readonly RegistryV2Rule[]>,
): Promise<Scan & { asOf: string }> {
  const resolvedRules = rules ?? (await import("./bundled-rules.js")).bundledRules();
  const reached = new Set(
    (await resolvedRules)
      .filter(
        (rule) => rule.event === "scheduled-end-of-life" && rule.deadline !== undefined && rule.deadline <= asOfDate,
      )
      .map((rule) => rule.id),
  );
  return {
    ...result,
    asOf: asOfDate,
    findings: result.findings.map((finding) =>
      reached.has(finding.ruleId)
        ? {
            ...finding,
            severity: REACHED_SEVERITY,
            summary: `As of ${asOfDate}, this has ended (deadline ${finding.deadline}). ${finding.summary}`,
          }
        : finding,
    ),
  };
}
