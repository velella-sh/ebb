import type { CheckResult, CheckMatch } from "../../check.js";
import type { CheckAllResult, CheckAllItem } from "../../check-all.js";
import type { Forecast } from "../../forecast.js";
import type { RegistryV2Rule } from "../../registry.js";
import type { RecentResult } from "../../recent.js";
import type { StaleResult } from "../../stale.js";
import type { UpcomingResult } from "../../upcoming.js";
import type { DataStatus } from "../../data-status.js";
import type { ReplacementItem } from "../../domain.js";
import { canonicalRuleUrl } from "../../site-routes.js";

export interface MarkdownFormatOptions {
  noHint?: boolean | undefined;
  dataStatus?: DataStatus | undefined;
  asOf?: string | undefined;
}

function statusEmoji(status: string): string {
  switch (status) {
    case "ok":
      return "✅ ok";
    case "scheduled":
      return "⚠️ scheduled";
    case "deprecated":
      return "❌ deprecated";
    case "unsupported":
      return "❌ unsupported";
    case "end-of-life":
      return "❌ end-of-life";
    case "removed":
      return "❌ removed";
    default:
      return `❌ ${status}`;
  }
}

export function formatCheckMarkdown(
  purl: string,
  version: string,
  result: CheckResult,
  options?: MarkdownFormatOptions,
): string {
  const lines: string[] = [];
  lines.push(`### Ebb Lifecycle Check: \`${purl}@${version}\`\n`);

  if (result.status === "ok") {
    lines.push(`✅ \`${purl}@${version}\` is supported and has no known end-of-life or deprecation findings.\n`);
    if (options?.dataStatus) {
      const s = options.dataStatus;
      lines.push(
        `---\n*Lifecycle data: ${s.source} (${s.version}) · ${s.ageDays}d old (reviewed through ${s.reviewedThrough})*\n`,
      );
      if (s.stale) {
        lines.push(
          `> ⚠️ **Warning:** Lifecycle data is ${s.ageDays} days old (exceeds ${s.staleAfterDays}d freshness threshold). Run \`ebb update\` to refresh.\n`,
        );
      }
    }
    return lines.join("\n");
  }

  lines.push("| Status | Event | Confidence | Days Left | Replacement | Rule |");
  lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");

  for (const match of result.matches) {
    const statusStr = statusEmoji(result.status);
    const dateStr = match.date ? ` (${match.date})` : "";
    const eventStr = `${match.event}${dateStr}`;
    const confStr = match.confidence ?? "-";
    const daysStr = match.daysLeft !== null && match.daysLeft !== undefined ? `${match.daysLeft} days` : "-";
    const repStr = match.replacement ? `\`${match.replacement}\`` : "-";
    const canonicalUrl = canonicalRuleUrl(match.ruleId);
    const ruleId = `\`${match.ruleId}\``;
    const ruleStr = canonicalUrl ? `[${ruleId}](${canonicalUrl})` : ruleId;
    lines.push(`| ${statusStr} | ${eventStr} | ${confStr} | ${daysStr} | ${repStr} | ${ruleStr} |`);
  }

  // Sources
  const allSources = result.matches.flatMap((m) => m.sources ?? []);
  if (allSources.length > 0) {
    lines.push("\n**Sources:**");
    for (const s of allSources) {
      lines.push(`- <${s.url}>`);
    }
  }

  if (options?.dataStatus) {
    const s = options.dataStatus;
    lines.push(
      `\n---\n*Lifecycle data: ${s.source} (${s.version}) · ${s.ageDays}d old (reviewed through ${s.reviewedThrough})*`,
    );
    if (s.stale) {
      lines.push(
        `\n> ⚠️ **Warning:** Lifecycle data is ${s.ageDays} days old (exceeds ${s.staleAfterDays}d freshness threshold). Run \`ebb update\` to refresh.\n`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function formatCheckAllMarkdown(
  items: CheckAllItem[],
  outcome: CheckAllResult,
  options?: MarkdownFormatOptions,
): string {
  const lines: string[] = [];
  const header = options?.asOf
    ? `### Ebb Lifecycle Check Summary (as of ${options.asOf})\n`
    : "### Ebb Lifecycle Check Summary\n";
  lines.push(header);

  lines.push("| Metric | Count |");
  lines.push("| :--- | :--- |");
  lines.push(`| **Total Checked** | ${outcome.summary.total} |`);
  lines.push(`| ✅ **ok** | ${outcome.summary.byStatus.ok} |`);
  if (outcome.summary.byStatus.scheduled > 0) {
    lines.push(`| ⚠️ **scheduled** | ${outcome.summary.byStatus.scheduled} |`);
  }
  if (outcome.summary.byStatus.deprecated > 0) {
    lines.push(`| ❌ **deprecated** | ${outcome.summary.byStatus.deprecated} |`);
  }
  if (outcome.summary.byStatus.unsupported > 0) {
    lines.push(`| ❌ **unsupported** | ${outcome.summary.byStatus.unsupported} |`);
  }
  if (outcome.summary.byStatus["end-of-life"] > 0) {
    lines.push(`| ❌ **end-of-life** | ${outcome.summary.byStatus["end-of-life"]} |`);
  }
  if (outcome.summary.byStatus.removed > 0) {
    lines.push(`| ❌ **removed** | ${outcome.summary.byStatus.removed} |`);
  }
  if (outcome.summary.errors > 0) {
    lines.push(`| ⚠️ **errors** | ${outcome.summary.errors} |`);
  }

  const findings: Array<{
    label: string;
    status: string;
    event: string;
    confidence: string;
    daysLeft: string;
    replacement: string;
    ruleId: string;
    source: string;
  }> = [];

  for (let i = 0; i < outcome.results.length; i++) {
    const res = outcome.results[i]!;
    const item = items[i];
    const label = item ? `${item.purl}@${item.version}` : `item ${i}`;

    if ("status" in res && res.status === "error") {
      findings.push({
        label,
        status: "error",
        event: "error",
        confidence: "-",
        daysLeft: "-",
        replacement: "-",
        ruleId: "-",
        source: res.message,
      });
    } else if ("status" in res && res.status !== "ok") {
      const checkRes = res as CheckResult;
      for (const m of checkRes.matches as CheckMatch[]) {
        const dateStr = m.date ? ` (${m.date})` : "";
        findings.push({
          label,
          status: checkRes.status,
          event: `${m.event}${dateStr}`,
          confidence: m.confidence ?? "-",
          daysLeft: m.daysLeft !== null && m.daysLeft !== undefined ? `${m.daysLeft} days` : "-",
          replacement: m.replacement ? `\`${m.replacement}\`` : "-",
          ruleId: `\`${m.ruleId}\``,
          source: m.sources && m.sources[0]?.url ? `<${m.sources[0].url}>` : "-",
        });
      }
    }
  }

  if (findings.length > 0) {
    lines.push("\n#### Findings\n");
    lines.push("| Component | Status | Event | Confidence | Days Left | Replacement | Rule | Source |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const f of findings) {
      lines.push(
        `| \`${f.label}\` | ${statusEmoji(f.status)} | ${f.event} | ${f.confidence} | ${f.daysLeft} | ${f.replacement} | ${f.ruleId} | ${f.source} |`,
      );
    }
  }

  if (options?.dataStatus) {
    const s = options.dataStatus;
    lines.push(
      `\n---\n*Lifecycle data: ${s.source} (${s.version}) · ${s.ageDays}d old (reviewed through ${s.reviewedThrough})*`,
    );
    if (s.stale) {
      lines.push(
        `\n> ⚠️ **Warning:** Lifecycle data is ${s.ageDays} days old (exceeds ${s.staleAfterDays}d freshness threshold). Run \`ebb update\` to refresh.\n`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function formatReplacementMarkdown(
  purl: string,
  version: string,
  replacement: string | null,
  replacements?: readonly ReplacementItem[],
): string {
  const lines: string[] = [];
  lines.push(`### Replacement for \`${purl}@${version}\`\n`);
  if (replacement) {
    lines.push(`Suggested replacement: **\`${replacement}\`**\n`);
    if (replacements && replacements.length > 0) {
      for (const item of replacements) {
        const versStr = item.vers ? ` \`${item.vers}\`` : "";
        const noteStr = item.note ? ` - ${item.note}` : "";
        lines.push(`- **${item.name}**: \`${item.purl}\`${versStr} [${item.kind}]${noteStr}`);
      }
      lines.push("");
    }
  } else {
    lines.push(`No suggested replacement registered for \`${purl}@${version}\`.\n`);
  }
  return lines.join("\n");
}

export function formatRulesMarkdown(purl: string, rules: RegistryV2Rule[]): string {
  const lines: string[] = [];
  lines.push(`### Lifecycle Rules for \`${purl}\`\n`);
  if (rules.length === 0) {
    lines.push(`No lifecycle rules found for \`${purl}\`.\n`);
    return lines.join("\n");
  }

  lines.push("| Rule ID | Event | Range | Deadline | Replacement |");
  lines.push("| :--- | :--- | :--- | :--- | :--- |");
  for (const r of rules) {
    const rep = r.replacement ? `\`${r.replacement}\`` : "-";
    const deadline = r.deadline ?? "-";
    lines.push(`| \`${r.id}\` | ${r.event} | \`${r.vers}\` | ${deadline} | ${rep} |`);
  }
  lines.push("");
  return lines.join("\n");
}

export function formatStaleMarkdown(result: StaleResult): string {
  const lines: string[] = [
    `### Stale lifecycle rules`,
    "",
    `**As of:** \`${result.asOf}\`  `,
    `**Soon within:** \`${result.soonWithin}\`  `,
    `**Counts:** ${result.counts.stale} stale · ${result.counts.staleSoon} soon · ${result.counts.fresh} fresh · ${result.counts.total} total`,
    "",
  ];

  if (result.stale.length === 0 && result.staleSoon.length === 0) {
    lines.push("No rules need review.\n");
    return lines.join("\n");
  }

  if (result.stale.length > 0) {
    lines.push("#### Already stale", "");
    lines.push("| Rule | Reviewed | Age | Window |");
    lines.push("| :--- | :--- | ---: | ---: |");
    for (const entry of result.stale) {
      lines.push(`| \`${entry.ruleId}\` | \`${entry.reviewedAt}\` | ${entry.ageDays}d | ${entry.maxReviewAgeDays}d |`);
    }
    lines.push("");
  }

  if (result.staleSoon.length > 0) {
    lines.push("#### Turning stale soon", "");
    lines.push("| Rule | Reviewed | Stale in | Window |");
    lines.push("| :--- | :--- | ---: | ---: |");
    for (const entry of result.staleSoon) {
      lines.push(
        `| \`${entry.ruleId}\` | \`${entry.reviewedAt}\` | ${entry.daysUntilStale}d | ${entry.maxReviewAgeDays}d |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatUpcomingMarkdown(result: UpcomingResult): string {
  const lines: string[] = [
    `### Upcoming Lifecycle Deadlines`,
    "",
    `**Window:** \`${result.within}\` (as of ${result.asOf}, until ${result.until})  `,
    `**Total events:** ${result.count}`,
    "",
  ];
  if (result.items.length === 0) {
    lines.push("No upcoming deadlines found within this window.\n");
    return lines.join("\n");
  }
  lines.push("| Deadline | Days Left | Severity | PURL | Event | Replacement |");
  lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
  for (const item of result.items) {
    const rep = item.replacement ? `\`${item.replacement}\`` : "-";
    const est = item.estimated ? " *(estimated)*" : "";
    lines.push(
      `| ${item.deadline}${est} | ${item.daysLeft}d | ${item.severity} | \`${item.purl}\` | ${item.event} | ${rep} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function formatRecentMarkdown(result: RecentResult): string {
  const lines: string[] = [
    `### Recent Lifecycle Deadlines`,
    "",
    `**Window:** \`${result.within}\` (as of ${result.asOf}, since ${result.since})  `,
    `**Total events:** ${result.count}`,
    "",
  ];
  if (result.items.length === 0) {
    lines.push("No recent deadlines found within this window.\n");
    return lines.join("\n");
  }
  lines.push("| Deadline | Days Ago | Severity | PURL | Event | Replacement |");
  lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
  for (const item of result.items) {
    const rep = item.replacement ? `\`${item.replacement}\`` : "-";
    const est = item.estimated ? " *(estimated)*" : "";
    lines.push(
      `| ${item.deadline}${est} | ${item.daysAgo}d | ${item.severity} | \`${item.purl}\` | ${item.event} | ${rep} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function formatForecastMarkdown(forecast: Forecast): string {
  const lines: string[] = [
    `### Ebb Lifecycle Forecast (${forecast.today} to ${forecast.until})\n`,
    `Total events: **${forecast.total}** across **${forecast.groups.length}** month${forecast.groups.length === 1 ? "" : "s"}.\n`,
  ];
  if (forecast.groups.length === 0) {
    lines.push("No dated lifecycle events found in this window.\n");
    return lines.join("\n");
  }
  for (const group of forecast.groups) {
    lines.push(`#### ${group.month}\n`);
    lines.push("| Date | Component | Severity | Rule |");
    lines.push("| :--- | :--- | :--- | :--- |");
    for (const event of group.events) {
      lines.push(`| ${event.date} | ${event.title} | ${event.severity} | \`${event.ruleId}\` |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
