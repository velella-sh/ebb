import type { CheckResult, CheckMatch } from "../../check.js";
import type { CheckAllResult, CheckAllItem } from "../../check-all.js";
import type { RegistryV2Rule } from "../../registry.js";
import { getOffingHint } from "../../hint.js";
import { createColors, type Colors } from "./color.js";

export interface TextFormatOptions {
  colors?: Colors | undefined;
  noHint?: boolean | undefined;
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
    return `${lines.join("\n")}\n`;
  }

  const icon = result.status === "scheduled" ? c.yellow("⚠") : c.red("✖");
  lines.push(`${icon} ${purl}@${version}: ${result.status}`);

  for (const match of result.matches) {
    lines.push(`  Rule: ${match.ruleId}`);
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

  const hint = getOffingHint(result.status, { noHint: options?.noHint });
  if (hint) {
    lines.push(`  ${hint}`);
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

  const hasIssues =
    outcome.summary.errors > 0 ||
    outcome.summary.byStatus.deprecated > 0 ||
    outcome.summary.byStatus.unsupported > 0 ||
    outcome.summary.byStatus["end-of-life"] > 0 ||
    outcome.summary.byStatus.removed > 0 ||
    outcome.summary.byStatus.scheduled > 0;

  if (hasIssues) {
    const hint = getOffingHint("deprecated", { noHint: options?.noHint });
    if (hint) {
      lines.push(`\n${hint}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatReplacementText(purl: string, version: string, replacement: string | null): string {
  if (replacement) {
    return `${replacement}\n`;
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
