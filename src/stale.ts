/**
 * `stale({ olderThan, asOf, rules })`: list lifecycle rules whose review window has
 * expired, and those that will expire within the next 30 days.
 *
 * Never reads a system clock unless the caller omits `asOf` / `clock` — pass a fixed
 * day in tests so the output is deterministic.
 */

import { getDataLoader } from "./data/load.js";
import { BUNDLED_ECOSYSTEMS } from "./data/ecosystems.js";
import { EbbError } from "./errors.js";
import {
  DEFAULT_MAX_REVIEW_AGE_DAYS,
  isIsoDate,
  type RegistryV2,
  type RegistryV2Rule,
  validateRegistryV2,
} from "./registry.js";
import { addDays, addMonths } from "./upcoming.js";

export const STALE_SCHEMA_VERSION = "ebb.stale.v1" as const;

/** How far ahead `staleSoon` looks when the caller does not set `soonWithin`. */
export const DEFAULT_STALE_SOON_DAYS = 30;

/** Marker embedded in the weekly GitHub issue so the workflow updates one issue, not many. */
export const STALE_ISSUE_MARKER = "<!-- ebb-stale-rules -->";

export const STALE_ISSUE_LABELS = ["good first issue", "type: task", "area: data", "lane: free-agent"] as const;

const MS_PER_DAY = 86_400_000;

export interface StaleOptions {
  /**
   * Review-age threshold that overrides every registry's `freshness.maxReviewAgeDays`.
   * A number is whole days; a string accepts `30d`, `2w`, `3m`, or `1y`.
   */
  readonly olderThan?: string | number | undefined;
  /** Reference day (`YYYY-MM-DD`). Defaults to UTC today from `clock`, or `new Date()`. */
  readonly asOf?: string | undefined;
  /** Injected clock used only when `asOf` is omitted. */
  readonly clock?: (() => Date) | undefined;
  /** Rules to inspect. When omitted, every bundled ecosystem registry is used. */
  readonly rules?: readonly RegistryV2Rule[] | undefined;
  /**
   * Registries that supply both rules (when `rules` is omitted) and per-ecosystem
   * `freshness.maxReviewAgeDays`.
   */
  readonly registries?: readonly RegistryV2[] | undefined;
  /**
   * Override for the review window. A number applies to every rule; a map is keyed by ecosystem.
   */
  readonly maxReviewAgeDays?: number | Readonly<Record<string, number>> | undefined;
  /** How far ahead to report rules that are not yet stale. Defaults to 30 days. */
  readonly soonWithin?: string | number | undefined;
}

export interface StaleFinding {
  readonly ruleId: string;
  readonly ecosystem: string;
  readonly title: string;
  readonly reviewedAt: string;
  readonly reviewer: string;
  readonly ageDays: number;
  readonly maxReviewAgeDays: number;
  /**
   * Whole UTC days until the rule becomes stale.
   * `0` means it became stale on `asOf`; negative means it has been stale longer.
   */
  readonly daysUntilStale: number;
  readonly purl: string;
}

export interface StaleResult {
  readonly schemaVersion: typeof STALE_SCHEMA_VERSION;
  readonly asOf: string;
  /** Threshold used when `olderThan` was set; otherwise null. */
  readonly olderThan: string | null;
  readonly soonWithin: string;
  readonly stale: readonly StaleFinding[];
  readonly staleSoon: readonly StaleFinding[];
  readonly counts: {
    readonly stale: number;
    readonly staleSoon: number;
    readonly fresh: number;
    readonly total: number;
  };
}

export interface ParsedDaySpan {
  readonly days: number;
  readonly span: string;
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY;
}

function requireIsoDate(value: string, label: string): void {
  if (!isIsoDate(value)) {
    throw new EbbError("invalid-date", `"${value}" is not a date (YYYY-MM-DD) for ${label}.`);
  }
}

/**
 * Parses a day-span such as `90`, `"90d"`, `"2w"`, `"3m"`, or `"1y"`.
 * Month and year spans are measured from `asOf` when provided so calendar months stay accurate.
 */
export function parseDaySpan(value: string | number, label: string, asOf?: string): ParsedDaySpan {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new EbbError("invalid-date", `Invalid ${label} "${value}". Expected a non-negative integer of days.`);
    }
    return { days: value, span: `${value}d` };
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    throw new EbbError("invalid-date", `Invalid ${label} "${value}".`);
  }

  const match = /^(\d+)\s*([dwmyDWMY])?$/.exec(trimmed);
  if (!match) {
    throw new EbbError(
      "invalid-date",
      `Invalid ${label} "${value}". Expected format like "30d", "2w", "3m", "1y", or a number of days.`,
    );
  }

  const amount = Number.parseInt(match[1]!, 10);
  const unit = (match[2] ?? "d").toLowerCase();
  const origin = asOf !== undefined && isIsoDate(asOf) ? asOf : "1970-01-01";

  switch (unit) {
    case "d":
      return { days: amount, span: `${amount}d` };
    case "w":
      return { days: amount * 7, span: `${amount}w` };
    case "m": {
      const until = addMonths(origin, amount);
      const days = Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${origin}T00:00:00Z`)) / MS_PER_DAY);
      return { days, span: `${amount}m` };
    }
    case "y": {
      const until = addMonths(origin, amount * 12);
      const days = Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${origin}T00:00:00Z`)) / MS_PER_DAY);
      return { days, span: `${amount}y` };
    }
    default:
      throw new EbbError("invalid-date", `Unsupported time unit in ${label} "${value}".`);
  }
}

/** Alias used by some callers/tests. */
export const parseDurationDays = (value: string | number, label: string, asOf?: string): number =>
  parseDaySpan(value, label, asOf).days;

function utcToday(clock: () => Date): string {
  return clock().toISOString().slice(0, 10);
}

const registryCache = new Map<string, RegistryV2>();

function bundledRegistry(ecosystem: string): RegistryV2 | undefined {
  const cached = registryCache.get(ecosystem);
  if (cached !== undefined) return cached;
  try {
    const loader = getDataLoader();
    if (typeof loader.readSync === "function") {
      const raw = loader.readSync(`registry/${ecosystem}.json`);
      if (raw && typeof raw === "object") {
        const validated = validateRegistryV2(raw);
        registryCache.set(ecosystem, validated);
        return validated;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

function loadDefaultRegistries(): RegistryV2[] {
  const registries: RegistryV2[] = [];
  for (const eco of BUNDLED_ECOSYSTEMS) {
    const registry = bundledRegistry(eco);
    if (registry !== undefined) registries.push(registry);
  }
  return registries;
}

function resolveMaxReviewAgeDays(
  ecosystem: string,
  options: StaleOptions,
  olderThanDays: number | undefined,
  freshnessByEcosystem: ReadonlyMap<string, number>,
): number {
  if (olderThanDays !== undefined) return olderThanDays;

  const override = options.maxReviewAgeDays;
  if (typeof override === "number") {
    if (!Number.isFinite(override) || !Number.isInteger(override) || override < 1) {
      throw new EbbError(
        "invalid-date",
        `Invalid maxReviewAgeDays "${override}". Expected a positive integer of days.`,
      );
    }
    return override;
  }
  if (override !== undefined) {
    const mapped = override[ecosystem];
    if (typeof mapped === "number") return mapped;
  }

  const fromRegistry = freshnessByEcosystem.get(ecosystem);
  if (fromRegistry !== undefined) return fromRegistry;

  const bundled = bundledRegistry(ecosystem)?.freshness?.maxReviewAgeDays;
  if (typeof bundled === "number" && bundled >= 1) return bundled;

  return DEFAULT_MAX_REVIEW_AGE_DAYS;
}

function collectRules(options: StaleOptions): {
  rules: readonly RegistryV2Rule[];
  freshnessByEcosystem: Map<string, number>;
} {
  const freshnessByEcosystem = new Map<string, number>();

  if (options.registries !== undefined) {
    for (const registry of options.registries) {
      const days = registry.freshness?.maxReviewAgeDays;
      if (typeof days === "number" && days >= 1) {
        freshnessByEcosystem.set(registry.ecosystem, days);
      }
    }
  }

  if (options.rules !== undefined) {
    return { rules: options.rules, freshnessByEcosystem };
  }

  if (options.registries !== undefined) {
    const rules: RegistryV2Rule[] = [];
    for (const registry of options.registries) {
      rules.push(...registry.rules);
    }
    return { rules, freshnessByEcosystem };
  }

  const registries = loadDefaultRegistries();
  for (const registry of registries) {
    const days = registry.freshness?.maxReviewAgeDays;
    if (typeof days === "number" && days >= 1) {
      freshnessByEcosystem.set(registry.ecosystem, days);
    }
  }
  const rules: RegistryV2Rule[] = [];
  for (const registry of registries) {
    rules.push(...registry.rules);
  }
  return { rules, freshnessByEcosystem };
}

/** The first calendar day on which a rule with the given review date is stale. */
export function staleOn(reviewedAt: string, maxReviewAgeDays: number): string {
  requireIsoDate(reviewedAt, "reviewedAt");
  if (!Number.isInteger(maxReviewAgeDays) || maxReviewAgeDays < 1) {
    throw new EbbError("invalid-date", `Invalid maxReviewAgeDays "${maxReviewAgeDays}".`);
  }
  return addDays(reviewedAt, maxReviewAgeDays + 1);
}

function toFinding(rule: RegistryV2Rule, asOf: string, maxReviewAgeDays: number): StaleFinding | null {
  const reviewedAt = rule.provenance?.reviewedAt;
  if (typeof reviewedAt !== "string" || !isIsoDate(reviewedAt)) return null;

  // Match registry.staleRules: stale when ageDays > maxReviewAgeDays.
  const ageDays = dayNumber(asOf) - dayNumber(reviewedAt);
  const daysUntilStale = dayNumber(staleOn(reviewedAt, maxReviewAgeDays)) - dayNumber(asOf);

  return {
    ruleId: rule.id,
    ecosystem: rule.ecosystem,
    title: rule.title,
    reviewedAt,
    reviewer: rule.provenance.reviewer,
    ageDays,
    maxReviewAgeDays,
    daysUntilStale,
    purl: rule.purl,
  };
}

/**
 * Rules whose last review is older than their freshness window, plus those that
 * will cross that window within `soonWithin` (default 30 days).
 */
export function stale(options: StaleOptions = {}): StaleResult {
  const clock = options.clock ?? (() => new Date());
  const asOf = options.asOf ?? utcToday(clock);
  requireIsoDate(asOf, "asOf");

  const olderThanParsed =
    options.olderThan === undefined ? undefined : parseDaySpan(options.olderThan, "olderThan", asOf);
  const soonParsed = parseDaySpan(options.soonWithin ?? DEFAULT_STALE_SOON_DAYS, "soonWithin", asOf);

  const { rules, freshnessByEcosystem } = collectRules(options);
  const staleFindings: StaleFinding[] = [];
  const soonFindings: StaleFinding[] = [];
  let fresh = 0;
  const seen = new Set<string>();

  for (const rule of rules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);

    const maxReviewAgeDays = resolveMaxReviewAgeDays(
      rule.ecosystem,
      options,
      olderThanParsed?.days,
      freshnessByEcosystem,
    );
    const finding = toFinding(rule, asOf, maxReviewAgeDays);
    if (finding === null) continue;

    if (finding.ageDays > maxReviewAgeDays) {
      staleFindings.push(finding);
    } else if (finding.daysUntilStale >= 1 && finding.daysUntilStale <= soonParsed.days) {
      soonFindings.push(finding);
    } else {
      fresh += 1;
    }
  }

  staleFindings.sort((left, right) => right.ageDays - left.ageDays || left.ruleId.localeCompare(right.ruleId));
  soonFindings.sort(
    (left, right) => left.daysUntilStale - right.daysUntilStale || left.ruleId.localeCompare(right.ruleId),
  );

  return {
    schemaVersion: STALE_SCHEMA_VERSION,
    asOf,
    olderThan: olderThanParsed?.span ?? null,
    soonWithin: soonParsed.span,
    stale: staleFindings,
    staleSoon: soonFindings,
    counts: {
      stale: staleFindings.length,
      staleSoon: soonFindings.length,
      fresh,
      total: seen.size,
    },
  };
}

/** Title for the single weekly maintainer issue. */
export function formatStaleIssueTitle(result: StaleResult): string {
  return `Stale lifecycle rules as of ${result.asOf}`;
}

/** Convenience title when only the day is known. */
export function staleIssueTitle(asOf: string): string {
  return `Stale lifecycle rules as of ${asOf}`;
}

/** Plain-text summary for CLI and logs. */
export function formatStaleText(result: StaleResult): string {
  const lines: string[] = [
    `Stale rules as of ${result.asOf}`,
    `${result.counts.stale} stale, ${result.counts.staleSoon} soon (within ${result.soonWithin}), ${result.counts.fresh} fresh`,
    "",
  ];

  if (result.stale.length > 0) {
    lines.push("Already stale:");
    for (const entry of result.stale) {
      lines.push(`  ${entry.ruleId}  reviewed ${entry.reviewedAt}  age ${entry.ageDays}d / ${entry.maxReviewAgeDays}d`);
    }
    lines.push("");
  }

  if (result.staleSoon.length > 0) {
    lines.push("Turning stale soon:");
    for (const entry of result.staleSoon) {
      lines.push(`  ${entry.ruleId}  reviewed ${entry.reviewedAt}  stale in ${entry.daysUntilStale}d`);
    }
    lines.push("");
  }

  if (result.stale.length === 0 && result.staleSoon.length === 0) {
    lines.push("No rules need review.");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/** Markdown body for the weekly issue (includes the stable marker). */
export function formatStaleIssueBody(result: StaleResult): string {
  const lines: string[] = [
    STALE_ISSUE_MARKER,
    "",
    `Ebb found **${result.counts.stale}** stale rule${result.counts.stale === 1 ? "" : "s"}`,
    `and **${result.counts.staleSoon}** rule${result.counts.staleSoon === 1 ? "" : "s"} that turn stale within ${result.soonWithin}`,
    `(as of \`${result.asOf}\`).`,
    "",
    "Review the source, update the rule and its `provenance.reviewedAt`, then refresh the source lock if needed.",
    "This is a good first task: pick one rule, verify its sources, and open a small pull request.",
    "",
  ];

  if (result.stale.length > 0) {
    lines.push("## Stale", "");
    for (const entry of result.stale) {
      lines.push(
        `- [ ] \`${entry.ruleId}\` — reviewed \`${entry.reviewedAt}\` (${entry.ageDays}d old, window ${entry.maxReviewAgeDays}d)`,
      );
    }
    lines.push("");
  }

  if (result.staleSoon.length > 0) {
    lines.push("## Turning stale soon", "");
    for (const entry of result.staleSoon) {
      lines.push(`- [ ] \`${entry.ruleId}\` — reviewed \`${entry.reviewedAt}\` (stale in ${entry.daysUntilStale}d)`);
    }
    lines.push("");
  }

  if (result.stale.length === 0 && result.staleSoon.length === 0) {
    lines.push("No rules need review.", "");
  }

  lines.push(`Generated by \`stale()\` on \`${result.asOf}\`.`);
  return lines.join("\n");
}

/** shields.io endpoint JSON for the stale-rules badge. */
export function staleBadgeEndpoint(result: StaleResult): {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
} {
  const count = result.counts.stale;
  return {
    schemaVersion: 1,
    label: "stale rules",
    message: String(count),
    color: count === 0 ? "3F6E66" : "B35B48",
  };
}
