/**
 * `upcoming({ within, ecosystem, purls, asOf, rules })`:
 * List scheduled and upcoming lifecycle deadlines within a specified time window.
 */

import type { EvidenceSource, Severity } from "./domain.js";
import { EbbError } from "./errors.js";
import { parsePurl, purlIdentity } from "./purl.js";
import { isIsoDate, type LifecycleEvent, type RegistryV2Rule } from "./registry.js";
import { BUNDLED_ECOSYSTEMS } from "./data/ecosystems.js";
import { loadEcosystemSync } from "./data/load.js";
import { versContains } from "./vers.js";

/** Add whole days to a UTC ISO date string (YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Add whole months to a UTC ISO date string (YYYY-MM-DD). */
export function addMonths(date: string, months: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result.toISOString().slice(0, 10);
}

export class UpcomingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpcomingError";
  }
}

export interface UpcomingItem {
  readonly ruleId: string;
  readonly purl: string;
  readonly ecosystem: string;
  readonly event: LifecycleEvent;
  readonly title: string;
  readonly severity: Severity;
  readonly deadline: string;
  readonly daysLeft: number;
  readonly estimated: boolean;
  readonly replacement: string | null;
  readonly sources: EvidenceSource[];
  readonly reviewedAt: string | null;
}

export interface UpcomingOptions {
  /**
   * Time window span, e.g. "30d", "90d", "2w", "3m", "1y", or number of days.
   * Defaults to "90d".
   */
  readonly within?: string | number | undefined;
  /**
   * Filter events by ecosystem name or array of ecosystem names (e.g. "npm" or ["npm", "python"]).
   */
  readonly ecosystem?: string | readonly string[] | undefined;
  /**
   * Filter events by target PURL(s).
   * When a version is present (e.g. `pkg:npm/express@4.18.0`), only rules matching that version are returned.
   */
  readonly purls?: readonly string[] | undefined;
  /**
   * Reference date for time calculations (YYYY-MM-DD). Defaults to UTC today.
   */
  readonly asOf?: string | undefined;
  /**
   * Custom list of rules to inspect instead of reading active registry data.
   */
  readonly rules?: readonly RegistryV2Rule[] | undefined;
}

export interface UpcomingResult {
  readonly asOf: string;
  readonly within: string;
  readonly until: string;
  readonly count: number;
  readonly items: UpcomingItem[];
}

export interface ParsedWithin {
  readonly until: string;
  readonly days: number;
  readonly span: string;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const MS_PER_DAY = 86_400_000;

/**
 * Parses a window specification into target `until` date and total whole days.
 * Supported units: "d" (days), "w" (weeks), "m" (months), "y" (years), or bare numbers.
 */
export function parseWithinWindow(within: string | number | undefined, asOf: string): ParsedWithin {
  if (within === undefined || within === null || within === "") {
    const defaultDays = 90;
    return {
      span: "90d",
      days: defaultDays,
      until: addDays(asOf, defaultDays),
    };
  }

  if (typeof within === "number") {
    if (!Number.isFinite(within) || within < 0 || !Number.isInteger(within)) {
      throw new UpcomingError(`Invalid within window "${within}". Expected a non-negative integer of days.`);
    }
    return {
      span: `${within}d`,
      days: within,
      until: addDays(asOf, within),
    };
  }

  const trimmed = within.trim();
  const match = /^(\d+)\s*([dwmyDWMY])?$/.exec(trimmed);
  if (!match) {
    throw new UpcomingError(
      `Invalid within window "${within}". Expected format like "30d", "2w", "3m", "1y", or number of days.`,
    );
  }

  const amount = parseInt(match[1]!, 10);
  const unit = (match[2] ?? "d").toLowerCase();

  switch (unit) {
    case "d": {
      return {
        span: `${amount}d`,
        days: amount,
        until: addDays(asOf, amount),
      };
    }
    case "w": {
      const days = amount * 7;
      return {
        span: `${amount}w`,
        days,
        until: addDays(asOf, days),
      };
    }
    case "m": {
      const until = addMonths(asOf, amount);
      const days = Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / MS_PER_DAY);
      return {
        span: `${amount}m`,
        days,
        until,
      };
    }
    case "y": {
      const until = addMonths(asOf, amount * 12);
      const days = Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / MS_PER_DAY);
      return {
        span: `${amount}y`,
        days,
        until,
      };
    }
    default:
      throw new UpcomingError(`Unsupported time unit in "${within}".`);
  }
}

interface ParsedTargetPurl {
  identity: string;
  version?: string | undefined;
}

function parseTargetPurl(purlStr: string): ParsedTargetPurl {
  try {
    const parsed = parsePurl(purlStr);
    return {
      identity: purlIdentity(parsed),
      version: parsed.version,
    };
  } catch {
    // If not a standard PURL, use trimmed string as identity
    return { identity: purlStr.trim() };
  }
}

/**
 * Returns upcoming software deprecation and end-of-life events within the specified time window.
 */
export function upcoming(options: UpcomingOptions = {}): UpcomingResult {
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  if (!isIsoDate(asOf)) {
    throw new EbbError("invalid-date", `"${asOf}" is not a date (YYYY-MM-DD).`);
  }

  const { until, span } = parseWithinWindow(options.within, asOf);

  // Normalize ecosystem filters
  const ecosystemFilter: Set<string> | undefined = options.ecosystem
    ? new Set(
        (Array.isArray(options.ecosystem) ? options.ecosystem : [options.ecosystem])
          .map((eco) => eco.trim().toLowerCase())
          .filter(Boolean),
      )
    : undefined;

  // Normalize target purl filters
  const targetPurls: ParsedTargetPurl[] | undefined =
    options.purls && options.purls.length > 0 ? options.purls.map(parseTargetPurl) : undefined;

  // Collect candidate rules
  let candidateRules: readonly RegistryV2Rule[];
  if (options.rules) {
    candidateRules = options.rules;
  } else if (ecosystemFilter && ecosystemFilter.size > 0) {
    const collected: RegistryV2Rule[] = [];
    for (const eco of ecosystemFilter) {
      if ((BUNDLED_ECOSYSTEMS as readonly string[]).includes(eco)) {
        collected.push(...loadEcosystemSync(eco));
      }
    }
    candidateRules = collected;
  } else {
    const collected: RegistryV2Rule[] = [];
    for (const eco of BUNDLED_ECOSYSTEMS) {
      collected.push(...loadEcosystemSync(eco));
    }
    candidateRules = collected;
  }

  const items: UpcomingItem[] = [];
  const seenRuleIds = new Set<string>();

  for (const rule of candidateRules) {
    const deadline = rule.deadline;
    if (!deadline || !isIsoDate(deadline)) {
      continue;
    }

    // Must fall within the [asOf, until] window
    if (deadline < asOf || deadline > until) {
      continue;
    }

    // Filter by ecosystem if provided
    if (ecosystemFilter && !ecosystemFilter.has(rule.ecosystem.toLowerCase())) {
      continue;
    }

    // Filter by purls if provided
    if (targetPurls) {
      let ruleIdentity: string;
      try {
        ruleIdentity = purlIdentity(rule.purl);
      } catch {
        ruleIdentity = rule.purl;
      }

      const matchesAnyTarget = targetPurls.some((target) => {
        if (target.identity !== ruleIdentity) return false;
        if (target.version) {
          try {
            return versContains(rule.vers, target.version);
          } catch {
            return false;
          }
        }
        return true;
      });

      if (!matchesAnyTarget) {
        continue;
      }
    }

    if (seenRuleIds.has(rule.id)) {
      continue;
    }
    seenRuleIds.add(rule.id);

    const diffMs = Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`);
    const daysLeft = Math.max(0, Math.floor(diffMs / MS_PER_DAY));

    const ruleRecord = rule as unknown as Record<string, unknown>;
    const isEstimated = Boolean(
      rule["x-estimated"] ??
        ruleRecord.estimated ??
        (rule.event === "scheduled-end-of-life" && ruleRecord.tentative) ??
        false,
    );

    items.push({
      ruleId: rule.id,
      purl: rule.purl,
      ecosystem: rule.ecosystem,
      event: rule.event,
      title: rule.title,
      severity: rule.severity,
      deadline,
      daysLeft,
      estimated: isEstimated,
      replacement: rule.replacement ?? null,
      sources: rule.sources ?? [],
      reviewedAt: rule.provenance?.reviewedAt ?? null,
    });
  }

  // Sort: date ascending, then severity descending, then ruleId
  items.sort((a, b) => {
    const dateComp = a.deadline.localeCompare(b.deadline);
    if (dateComp !== 0) return dateComp;
    const sevComp = (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99);
    if (sevComp !== 0) return sevComp;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return {
    asOf,
    within: span,
    until,
    count: items.length,
    items,
  };
}
