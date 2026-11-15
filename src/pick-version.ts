/**
 * `supportedVersions`: which release lines Ebb knows, and which one it would take.
 * A line is named only when a rule's VERS range is exactly one release step. Ebb does not
 * invent lines it has no rule for, and it does not call a line supported.
 */

import { CheckError } from "./check-core.js";
import { resolveCandidateRules } from "./check-core.js";
import { EbbError } from "./errors.js";
import { normalizePurl, parsePurl, purlIdentity } from "./purl.js";
import { isIsoDate, lifecycleEventPrecedence } from "./registry.js";
import type { LifecycleEvent, RegistryV2Rule } from "./registry.js";
import { releaseLineFromVers } from "./rule-versions.js";
import { parseVers } from "./vers.js";
import { versionScheme } from "./vers.js";

/** How far ahead an end date must sit before Ebb will recommend that line. */
export const RECOMMEND_AFTER_DAYS = 180;

/** `ended` is on or before the reference day, `ending` is later, `no-known-end` has no date. */
export type ReleaseLineStatus = "ended" | "ending" | "no-known-end";

/** One release line taken from the rule that carries the most serious event for that line. */
export interface ReleaseLine {
  readonly id: string;
  readonly vers: string;
  readonly status: ReleaseLineStatus;
  readonly endDate: string | null;
  readonly ruleId: string;
  readonly event: LifecycleEvent;
}

/** The line Ebb would take, with the sentence that explains the choice. */
export interface VersionRecommendation {
  readonly lineId: string;
  readonly reason: string;
}

export interface SupportedVersionsOptions {
  /** Reference day (`YYYY-MM-DD`). When omitted, the UTC calendar day is read once. */
  readonly asOf?: string | undefined;
  /** Rules to read instead of the active registry. Observed-at filtering still applies. */
  readonly rules?: readonly RegistryV2Rule[] | undefined;
}

/** Release lines, the recommendation, and whether the numbered lines have gaps. */
export interface SupportedVersionsResult {
  /** Canonical package URL, or null when a product name matches nothing. */
  readonly purl: string | null;
  readonly asOf: string;
  readonly lines: readonly ReleaseLine[];
  readonly recommendation: VersionRecommendation | null;
  /** Why that line was chosen, or why none was. */
  readonly reason: string;
  /**
   * True only when a `*` rule covers every version, or the numbered lines from the oldest
   * known line through the newest have no gap. A note about versions newer than the last
   * rule does not by itself make this false.
   */
  readonly complete: boolean;
  readonly notes: readonly string[];
}

function requireIsoDate(value: string): void {
  if (!isIsoDate(value)) throw new EbbError("invalid-date", `"${value}" is not a date (YYYY-MM-DD).`);
}

/** The UTC calendar day. Called only when the caller did not pass `asOf`. */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

/** `days` calendar days after `isoDate`. Does not read the system clock. */
function addUtcDays(isoDate: string, days: number): string {
  let [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  let left = days;
  while (left > 0) {
    const room = daysInMonth(year, month) - day;
    if (left <= room) {
      day += left;
      left = 0;
    } else {
      left -= room + 1;
      day = 1;
      month += 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
    }
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isReleaseRule(rule: RegistryV2Rule): boolean {
  return rule.usage === undefined || rule.usage.some((matcher) => matcher.kind !== "symbol");
}

function effectiveEvent(rule: RegistryV2Rule, asOf: string): LifecycleEvent {
  if (rule.event === "scheduled-end-of-life" && rule.deadline !== undefined && rule.deadline <= asOf) {
    return "end-of-life";
  }
  return rule.event;
}

function seriousness(event: LifecycleEvent): number {
  const index = lifecycleEventPrecedence.indexOf(event);
  return index === -1 ? lifecycleEventPrecedence.length : index;
}

function lineStatus(event: LifecycleEvent, deadline: string | undefined, asOf: string): ReleaseLineStatus {
  if (deadline !== undefined) return deadline <= asOf ? "ended" : "ending";
  if (event === "scheduled-end-of-life" || event === "end-of-active-support") return "no-known-end";
  return "ended";
}

interface SelectedRules {
  readonly purl: string | null;
  readonly rules: readonly RegistryV2Rule[];
}

function selectCustom(purlOrName: string, rules: readonly RegistryV2Rule[]): SelectedRules {
  if (purlOrName.toLowerCase().startsWith("pkg:")) {
    const identity = purlIdentity(parsePurl(normalizePurl(purlOrName)));
    return { purl: identity, rules: rules.filter((rule) => purlIdentity(rule.purl) === identity) };
  }
  const needle = purlOrName.toLowerCase();
  const matched = rules.filter((rule) => {
    try {
      return parsePurl(rule.purl).name.toLowerCase() === needle || rule.ecosystem === needle;
    } catch {
      return false;
    }
  });
  return { purl: matched[0] ? purlIdentity(matched[0].purl) : null, rules: matched };
}

function selectRules(purlOrName: string, custom: readonly RegistryV2Rule[] | undefined): SelectedRules {
  if (custom !== undefined) return selectCustom(purlOrName, custom);
  if (purlOrName.toLowerCase().startsWith("pkg:")) {
    const identity = purlIdentity(parsePurl(normalizePurl(purlOrName)));
    return { purl: identity, rules: resolveCandidateRules(purlOrName) };
  }
  try {
    const rules = resolveCandidateRules(purlOrName);
    return { purl: rules[0] ? purlIdentity(rules[0].purl) : null, rules };
  } catch (error) {
    if (error instanceof CheckError && error.message.startsWith("Unknown product ")) {
      return { purl: null, rules: [] };
    }
    throw error;
  }
}

type UnboundedKind = "below" | "above" | "other";

function unboundedKind(vers: string): UnboundedKind {
  const parsed = parseVers(vers);
  const bounds = parsed.constraints.filter(
    (constraint) => constraint.comparator !== "=" && constraint.comparator !== "!=",
  );
  const lower = bounds.filter((constraint) => constraint.comparator === ">" || constraint.comparator === ">=");
  const upper = bounds.filter((constraint) => constraint.comparator === "<" || constraint.comparator === "<=");
  if (upper.length > 0 && lower.length === 0) return "below";
  if (lower.length > 0 && upper.length === 0) return "above";
  return "other";
}

interface BuiltLine {
  readonly line: ReleaseLine;
  readonly lower: string;
  readonly scheme: string;
}

function chooseRule(current: RegistryV2Rule | undefined, candidate: RegistryV2Rule, asOf: string): RegistryV2Rule {
  if (!current) return candidate;
  const byEvent = seriousness(effectiveEvent(candidate, asOf)) - seriousness(effectiveEvent(current, asOf));
  if (byEvent !== 0) return byEvent < 0 ? candidate : current;
  const candidateDate = candidate.deadline ?? "9999-12-31";
  const currentDate = current.deadline ?? "9999-12-31";
  if (candidateDate !== currentDate) return candidateDate < currentDate ? candidate : current;
  return candidate.id < current.id ? candidate : current;
}

function missingLineIds(lines: readonly ReleaseLine[]): string[] {
  const majors: number[] = [];
  const families = new Map<string, number[]>();
  for (const line of lines) {
    if (line.id === "*") continue;
    const major = /^(\d+)\.x$/.exec(line.id);
    if (major?.[1]) {
      majors.push(Number(major[1]));
      continue;
    }
    const parts = line.id.split(".");
    const step = Number(parts[parts.length - 1]);
    const family = parts.slice(0, -1).join(".");
    if (!Number.isInteger(step) || family === "") continue;
    const bucket = families.get(family) ?? [];
    bucket.push(step);
    families.set(family, bucket);
  }

  const missing: string[] = [];
  const majorsSorted = [...new Set(majors)].sort((left, right) => left - right);
  for (let index = 1; index < majorsSorted.length; index++) {
    const previous = majorsSorted[index - 1] ?? 0;
    const next = majorsSorted[index] ?? previous;
    for (let number = previous + 1; number < next; number++) missing.push(`${number}.x`);
  }
  for (const [family, steps] of families) {
    const sorted = [...new Set(steps)].sort((left, right) => left - right);
    for (let index = 1; index < sorted.length; index++) {
      const previous = sorted[index - 1] ?? 0;
      const next = sorted[index] ?? previous;
      for (let number = previous + 1; number < next; number++) missing.push(`${family}.${number}`);
    }
  }
  return missing;
}

function sortBuilt(lines: readonly BuiltLine[]): BuiltLine[] {
  return [...lines].sort((left, right) => {
    if (left.line.id === "*") return -1;
    if (right.line.id === "*") return 1;
    if (left.scheme === right.scheme) return versionScheme(left.scheme).compare(left.lower, right.lower);
    return left.line.id.localeCompare(right.line.id, "en", { numeric: true });
  });
}

function recommend(
  lines: readonly ReleaseLine[],
  asOf: string,
  complete: boolean,
): { recommendation: VersionRecommendation | null; reason: string } {
  const ending = lines.filter((line) => line.status === "ending" && line.endDate !== null);
  if (ending.length === 0) {
    if (lines.length === 0) return { recommendation: null, reason: "Ebb has no release lines for this component." };
    if (lines.every((line) => line.status === "ended")) {
      return { recommendation: null, reason: "Every known release line has already ended." };
    }
    return { recommendation: null, reason: "No known release line has an end date, so Ebb recommends none." };
  }

  const latest = [...ending].sort((left, right) => {
    const byDate = (left.endDate ?? "").localeCompare(right.endDate ?? "");
    if (byDate !== 0) return byDate;
    return lines.indexOf(left) - lines.indexOf(right);
  })[ending.length - 1];
  if (!latest?.endDate) {
    return { recommendation: null, reason: "No known release line has an end date, so Ebb recommends none." };
  }

  const horizon = addUtcDays(asOf, RECOMMEND_AFTER_DAYS);
  if (latest.endDate <= horizon) {
    return {
      recommendation: null,
      reason: `The latest known end date is ${latest.endDate} (${latest.id}), which is within ${RECOMMEND_AFTER_DAYS} days, so Ebb recommends no line.`,
    };
  }

  const reason = complete
    ? `${latest.id} has the latest known end date (${latest.endDate}).`
    : `${latest.id} has the latest known end date (${latest.endDate}). The answer is incomplete.`;
  return { recommendation: { lineId: latest.id, reason }, reason };
}

function emptyResult(purl: string | null, asOf: string, note: string): SupportedVersionsResult {
  return {
    purl,
    asOf,
    lines: [],
    recommendation: null,
    reason: "Ebb has no release lines for this component.",
    complete: false,
    notes: [note],
  };
}

function evaluate(
  purlOrName: string,
  asOf: string,
  custom: readonly RegistryV2Rule[] | undefined,
): SupportedVersionsResult {
  const selected = selectRules(purlOrName, custom);
  const releaseRules = selected.rules.filter(isReleaseRule);
  const visible = releaseRules.filter((rule) => rule.provenance.observedAt <= asOf);
  if (visible.length === 0) {
    const note =
      selected.rules.length === 0
        ? "Ebb has no rules for this component."
        : releaseRules.length === 0
          ? "Ebb has rules for this component, but none of them name a release line."
          : "Ebb has no rules for this component as of this date.";
    return emptyResult(selected.purl, asOf, note);
  }

  const byLine = new Map<string, { rule: RegistryV2Rule; lower: string; scheme: string }>();
  const below: string[] = [];
  const above: string[] = [];
  let other = 0;

  for (const rule of visible) {
    const bounds = releaseLineFromVers(rule.vers);
    if (!bounds) {
      const kind = unboundedKind(rule.vers);
      if (kind === "below") below.push(rule.id);
      else if (kind === "above") above.push(rule.id);
      else other += 1;
      continue;
    }
    const current = byLine.get(bounds.id);
    byLine.set(bounds.id, {
      rule: chooseRule(current?.rule, rule, asOf),
      lower: bounds.lower,
      scheme: bounds.scheme,
    });
  }

  const built = sortBuilt(
    [...byLine.entries()].map(([id, chosen]) => {
      const event = effectiveEvent(chosen.rule, asOf);
      const endDate = chosen.rule.deadline ?? null;
      return {
        lower: chosen.lower,
        scheme: chosen.scheme,
        line: {
          id,
          vers: chosen.rule.vers,
          status: lineStatus(event, chosen.rule.deadline, asOf),
          endDate,
          ruleId: chosen.rule.id,
          event,
        },
      };
    }),
  );
  const lines = built.map((entry) => entry.line);
  const hasStar = lines.some((line) => line.id === "*");
  const missing = hasStar ? [] : missingLineIds(lines);
  const complete = hasStar || (lines.length > 0 && missing.length === 0);

  const notes: string[] = [];
  if (lines.length === 0) {
    notes.push("Ebb has rules for this component, but none of them name a single release line.");
  }
  for (const id of missing) notes.push(`No rule covers ${id}.`);
  if (!hasStar && below.length > 0 && lines.length > 0) {
    const oldest = lines.find((line) => line.id !== "*")?.id ?? lines[0]?.id;
    notes.push(
      `Versions older than ${oldest} are covered by ${below.join(", ")} as one open range, not as separate lines.`,
    );
  }
  if (above.length > 0) {
    const shown = above.slice(0, 3).join(", ");
    const extra = above.length > 3 ? ` and ${above.length - 3} more` : "";
    notes.push(`A rule covers versions upward without closing the release line (${shown}${extra}).`);
  }
  if (other > 0) notes.push("Some rules name individual versions or a span, not a single release line.");
  if (!hasStar && lines.length > 0) {
    const newest = lines[lines.length - 1];
    if (newest) notes.push(`Ebb has no rule for versions newer than ${newest.id}.`);
  }

  const { recommendation, reason } = recommend(lines, asOf, complete);
  return { purl: selected.purl, asOf, lines, recommendation, reason, complete, notes };
}

/**
 * Lists the release lines Ebb can name for a component, and recommends the one whose known
 * end date is furthest ahead when that date is more than {@link RECOMMEND_AFTER_DAYS} days
 * after the reference day. An unknown component is an empty answer, not a supported one.
 * Passing `asOf` does not read the system clock.
 */
export function supportedVersions(purlOrName: string, options?: SupportedVersionsOptions): SupportedVersionsResult {
  const asOf = options?.asOf;
  if (asOf !== undefined) {
    requireIsoDate(asOf);
    return evaluate(purlOrName, asOf, options?.rules);
  }
  return evaluate(purlOrName, utcToday(), options?.rules);
}
