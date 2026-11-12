import type { CheckResult, CheckMatch } from "../../check.js";
import type { CheckAllResult, CheckAllItem } from "../../check-all.js";
import type { RegistryV2Rule } from "../../registry.js";
import { getOffingHint } from "../../hint.js";

export interface MarkdownFormatOptions {
  noHint?: boolean | undefined;
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
    return lines.join("\n");
  }

  lines.push("| Status | Event | Days Left | Replacement | Rule |");
  lines.push("| :--- | :--- | :--- | :--- | :--- |");

  for (const match of result.matches) {
    const statusStr = statusEmoji(result.status);
    const dateStr = match.date ? ` (${match.date})` : "";
    const eventStr = `${match.event}${dateStr}`;
    const daysStr = match.daysLeft !== null && match.daysLeft !== undefined ? `${match.daysLeft} days` : "-";
    const repStr = match.replacement ? `\`${match.replacement}\`` : "-";
    const ruleStr = `\`${match.ruleId}\``;
    lines.push(`| ${statusStr} | ${eventStr} | ${daysStr} | ${repStr} | ${ruleStr} |`);
  }

  // Sources
  const allSources = result.matches.flatMap((m) => m.sources ?? []);
  if (allSources.length > 0) {
    lines.push("\n**Sources:**");
    for (const s of allSources) {
      lines.push(`- <${s.url}>`);
    }
  }

  const hint = getOffingHint(result.status, { noHint: options?.noHint, markdown: true });
  if (hint) {
    lines.push(`\n> ${hint}`);
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
  lines.push("### Ebb Lifecycle Check Summary\n");

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
    lines.push("| Component | Status | Event | Days Left | Replacement | Rule | Source |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const f of findings) {
      lines.push(
        `| \`${f.label}\` | ${statusEmoji(f.status)} | ${f.event} | ${f.daysLeft} | ${f.replacement} | ${f.ruleId} | ${f.source} |`,
      );
    }
  }

  const hasIssues =
    outcome.summary.errors > 0 ||
    outcome.summary.byStatus.deprecated > 0 ||
    outcome.summary.byStatus.unsupported > 0 ||
    outcome.summary.byStatus["end-of-life"] > 0 ||
    outcome.summary.byStatus.removed > 0 ||
    outcome.summary.byStatus.scheduled > 0;

  if (hasIssues) {
    const hint = getOffingHint("deprecated", { noHint: options?.noHint, markdown: true });
    if (hint) {
      lines.push(`\n> ${hint}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function formatReplacementMarkdown(purl: string, version: string, replacement: string | null): string {
  const lines: string[] = [];
  lines.push(`### Replacement for \`${purl}@${version}\`\n`);
  if (replacement) {
    lines.push(`Suggested replacement: **\`${replacement}\`**\n`);
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
