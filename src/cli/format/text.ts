import type { CheckResult, CheckMatch } from "../../check.js";
import type { CheckAllResult, CheckAllItem } from "../../check-all.js";
import type { Forecast } from "../../forecast.js";
import type { RegistryV2Rule } from "../../registry.js";
import type { RecentResult } from "../../recent.js";
import type { UpcomingResult } from "../../upcoming.js";
import type { DataStatus } from "../../data-status.js";
import type { ReplacementItem } from "../../domain.js";
import { createColors, type Colors } from "./color.js";

export interface TextFormatOptions {
  colors?: Colors | undefined;
  noHint?: boolean | undefined;
  dataStatus?: DataStatus | undefined;
  asOf?: string | undefined;
}

export function formatCheckText(
  purl: string,
  version: string,
  result: CheckResult,
  options?: TextFormatOptions,
): string {
  const c = options?.colors ?? createColors(false);
  const lines: string[] = [];

  if (result.status === "ok") {
    lines.push(`${c.green("✓")} ${purl}@${version} is ok`);
    if (options?.dataStatus) {
      const s = options.dataStatus;
      lines.push(c.dim(`Data: ${s.source} (${s.version}), ${s.ageDays}d old (reviewed ${s.reviewedThrough})`));
      if (s.stale) {
        lines.push(
          c.yellow(
            `⚠ Warning: Data is ${s.ageDays}d old (exceeds ${s.staleAfterDays}d threshold). Run 'ebb update' to refresh.`,
          ),
        );
      }
    }
    return `${lines.join("\n")}\n`;
  }

  const icon = result.status === "scheduled" ? c.yellow("⚠") : c.red("✖");
  lines.push(`${icon} ${purl}@${version}: ${result.status}`);

  if (result.extendedSupportUntil) {
    const extMatch = result.matches.find(
      (m) => m.date === result.extendedSupportUntil || m.ruleId.includes("extended-support"),
    );
    const sourceTitle = extMatch?.sources?.[0]?.title;
    lines.push(`  Extended support until ${result.extendedSupportUntil}${sourceTitle ? ` (${sourceTitle})` : ""}`);
  }

  for (const match of result.matches) {
    lines.push(`  Rule: ${match.ruleId}`);
    if (match.confidence) {
      lines.push(`  Confidence: ${match.confidence}`);
    }
    const dateStr = match.date ? ` (${match.date})` : "";
    const daysStr = match.daysLeft !== null && match.daysLeft !== undefined ? ` [${match.daysLeft} days left]` : "";
    lines.push(`  Event: ${match.event}${dateStr}${daysStr}`);

    if (match.replacement) {
      lines.push(`  Replacement: ${match.replacement}`);
    }

    if (match.sources && match.sources.length > 0) {
      lines.push("  Sources:");
      for (const s of match.sources) {
        lines.push(`    - ${s.url}`);
      }
    }
  }

  if (options?.dataStatus) {
    const s = options.dataStatus;
    lines.push(c.dim(`\nData: ${s.source} (${s.version}), ${s.ageDays}d old (reviewed ${s.reviewedThrough})`));
    if (s.stale) {
      lines.push(
        c.yellow(
          `⚠ Warning: Data is ${s.ageDays}d old (exceeds ${s.staleAfterDays}d threshold). Run 'ebb update' to refresh.`,
        ),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatCheckAllText(
  items: CheckAllItem[],
  outcome: CheckAllResult,
  options?: TextFormatOptions,
): string {
  const c = options?.colors ?? createColors(false);
  const lines: string[] = [];

  if (options?.asOf) {
    lines.push(`Ebb lifecycle check (as of ${options.asOf}):\n`);
  }

  for (let i = 0; i < outcome.results.length; i++) {
    const res = outcome.results[i]!;
    if ("status" in res && res.status === "error") {
      lines.push(`${c.red("✖")} [${res.index}] ${res.message}`);
    } else if ("status" in res) {
      const checkRes = res as CheckResult;
      const item = items[i];
      const label = item ? `${item.purl}@${item.version}` : `item ${i}`;

      if (checkRes.status === "ok") {
        lines.push(`${c.green("✓")} ${label}: ok`);
      } else {
        const icon = checkRes.status === "scheduled" ? c.yellow("⚠") : c.red("✖");
        const ruleIds = checkRes.matches.map((m: CheckMatch) => m.ruleId).join(", ");
        lines.push(`${icon} ${label}: ${checkRes.status}${ruleIds ? ` (${ruleIds})` : ""}`);

        if (checkRes.extendedSupportUntil) {
          const extMatch = checkRes.matches.find(
            (m: CheckMatch) => m.date === checkRes.extendedSupportUntil || m.ruleId.includes("extended-support"),
          );
          const sourceTitle = extMatch?.sources?.[0]?.title;
          lines.push(
            `    Extended support until ${checkRes.extendedSupportUntil}${sourceTitle ? ` (${sourceTitle})` : ""}`,
          );
        }

        const matchWithConfidence = checkRes.matches.find((m: CheckMatch) => m.confidence);
        if (matchWithConfidence?.confidence) {
          lines.push(`    Confidence: ${matchWithConfidence.confidence}`);
        }

        // Show days left if present
        const matchWithDays = checkRes.matches.find((m: CheckMatch) => m.daysLeft !== null && m.daysLeft !== undefined);
        if (matchWithDays && matchWithDays.daysLeft !== null && matchWithDays.daysLeft !== undefined) {
          lines.push(`    Days left: ${matchWithDays.daysLeft} days left`);
        }

        // Show replacement on its own line
        const matchWithReplacement = checkRes.matches.find((m: CheckMatch) => m.replacement);
        if (matchWithReplacement?.replacement) {
          lines.push(`    Replacement: ${matchWithReplacement.replacement}`);
        }

        // Show source link under finding
        const matchWithSource = checkRes.matches.find((m: CheckMatch) => m.sources && m.sources.length > 0);
        if (matchWithSource?.sources && matchWithSource.sources[0]?.url) {
          lines.push(`    Source: ${matchWithSource.sources[0].url}`);
        }
      }
    }
  }

  lines.push(`\nSummary (${outcome.summary.total} total):`);
  lines.push(`  ok:          ${outcome.summary.byStatus.ok}`);
  if (outcome.summary.byStatus.deprecated > 0) {
    lines.push(`  deprecated:  ${outcome.summary.byStatus.deprecated}`);
  }
  if (outcome.summary.byStatus.unsupported > 0) {
    lines.push(`  unsupported: ${outcome.summary.byStatus.unsupported}`);
  }
  if (outcome.summary.byStatus["end-of-life"] > 0) {
    lines.push(`  end-of-life: ${outcome.summary.byStatus["end-of-life"]}`);
  }
  if (outcome.summary.byStatus.removed > 0) {
    lines.push(`  removed:     ${outcome.summary.byStatus.removed}`);
  }
  if (outcome.summary.byStatus.scheduled > 0) {
    lines.push(`  scheduled:   ${outcome.summary.byStatus.scheduled}`);
  }
  if (outcome.summary.errors > 0) {
    lines.push(`  errors:      ${outcome.summary.errors}`);
  }

  if (options?.dataStatus) {
    const s = options.dataStatus;
    lines.push(c.dim(`\nData: ${s.source} (${s.version}), ${s.ageDays}d old (reviewed ${s.reviewedThrough})`));
    if (s.stale) {
      lines.push(
        c.yellow(
          `⚠ Warning: Data is ${s.ageDays}d old (exceeds ${s.staleAfterDays}d threshold). Run 'ebb update' to refresh.`,
        ),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatReplacementText(
  purl: string,
  version: string,
  replacement: string | null,
  replacements?: readonly ReplacementItem[],
): string {
  if (replacement) {
    const lines = [replacement];
    if (replacements && replacements.length > 0) {
      for (const item of replacements) {
        const versStr = item.vers ? ` (${item.vers})` : "";
        const noteStr = item.note ? ` - ${item.note}` : "";
        lines.push(`  - ${item.name}: ${item.purl}${versStr} [${item.kind}]${noteStr}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }
  return `No suggested replacement for ${purl}@${version}\n`;
}

export function formatRulesText(purl: string, rules: RegistryV2Rule[]): string {
  if (rules.length === 0) {
    return `No rules found for ${purl}\n`;
  }

  const lines: string[] = [`Found ${rules.length} rule${rules.length === 1 ? "" : "s"} for ${purl}:`];
  for (const rule of rules) {
    const deadline = rule.deadline ? ` (deadline: ${rule.deadline})` : "";
    lines.push(`- ${rule.id} [${rule.event}] vers: "${rule.vers}"${deadline}`);
    if (rule.replacement) {
      lines.push(`    Replacement: ${rule.replacement}`);
    }
    if (rule.sources && rule.sources.length > 0 && rule.sources[0]?.url) {
      lines.push(`    Source: ${rule.sources[0].url}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatUpcomingText(result: UpcomingResult, options?: TextFormatOptions): string {
  const c = options?.colors ?? createColors(false);
  const lines: string[] = [
    `Upcoming deadlines within ${result.within} (as of ${result.asOf}, until ${result.until}): ${result.count} event${result.count === 1 ? "" : "s"}`,
  ];
  if (result.items.length === 0) {
    lines.push("\nNo upcoming deadlines found within this window.\n");
    return lines.join("\n");
  }
  lines.push("");
  for (const item of result.items) {
    const sevColor =
      item.severity === "critical" || item.severity === "high" ? c.red : item.severity === "medium" ? c.yellow : c.dim;
    const est = item.estimated ? " [estimated]" : "";
    lines.push(`- ${item.deadline} (${item.daysLeft}d left) [${sevColor(item.severity)}] ${item.purl}${est}`);
    lines.push(`    Rule: ${item.ruleId} (${item.event}) - ${item.title}`);
    if (item.replacement) {
      lines.push(`    Replacement: ${item.replacement}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatRecentText(result: RecentResult, options?: TextFormatOptions): string {
  const c = options?.colors ?? createColors(false);
  const lines: string[] = [
    `Recent deadlines within ${result.within} (as of ${result.asOf}, since ${result.since}): ${result.count} event${result.count === 1 ? "" : "s"}`,
  ];
  if (result.items.length === 0) {
    lines.push("\nNo recent deadlines found within this window.\n");
    return lines.join("\n");
  }
  lines.push("");
  for (const item of result.items) {
    const sevColor =
      item.severity === "critical" || item.severity === "high" ? c.red : item.severity === "medium" ? c.yellow : c.dim;
    const est = item.estimated ? " [estimated]" : "";
    lines.push(`- ${item.deadline} (${item.daysAgo}d ago) [${sevColor(item.severity)}] ${item.purl}${est}`);
    lines.push(`    Rule: ${item.ruleId} (${item.event}) - ${item.title}`);
    if (item.replacement) {
      lines.push(`    Replacement: ${item.replacement}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function formatForecastText(forecast: Forecast, options?: TextFormatOptions): string {
  const c = options?.colors ?? createColors(false);
  const lines: string[] = [
    `Forecast from ${forecast.today} to ${forecast.until} (${forecast.months} month${forecast.months === 1 ? "" : "s"}): ${forecast.total} event${forecast.total === 1 ? "" : "s"}`,
    "",
  ];
  if (forecast.groups.length === 0) {
    lines.push("No dated lifecycle events found in this window.\n");
    return lines.join("\n");
  }
  for (const group of forecast.groups) {
    lines.push(group.month);
    for (const event of group.events) {
      const sevColor =
        event.severity === "critical" || event.severity === "high"
          ? c.red
          : event.severity === "medium"
            ? c.yellow
            : c.dim;
      lines.push(`  ${event.date}  ${event.title} [${sevColor(event.severity)}] (${event.ruleId})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
