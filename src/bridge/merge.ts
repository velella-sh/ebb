import { check } from "../check.js";
import { formatPurl, parsePurl } from "../purl.js";
import { rulesFor } from "../rules-for.js";
import type { BridgeCounts, BridgeLifecycleEntry, CombinedBridgeReport, ScannerBridgeInput } from "./types.js";

/**
 * Options when merging a scanner report into a combined lifecycle report.
 */
export interface MergeBridgeOptions {
  /** Optional reference date for lifecycle evaluation */
  asOf?: string | undefined;
}

/**
 * Merges scanner input with Ebb lifecycle rules into a combined report.
 * Preserves the original scanner findings without modification.
 */
export function mergeBridgeReport(input: ScannerBridgeInput, options?: MergeBridgeOptions): CombinedBridgeReport {
  const counts: BridgeCounts = {
    checked: 0,
    endOfLife: 0,
    deprecated: 0,
    unknown: 0,
    withoutPurl: 0,
  };

  const lifecycle: BridgeLifecycleEntry[] = [];

  for (const item of input.items) {
    if (!item.purl) {
      counts.withoutPurl += 1;
      lifecycle.push({
        packageId: item.id,
        name: item.name,
        version: item.version,
        target: item.target,
        status: "without-purl",
      });
      continue;
    }

    counts.checked += 1;

    let basePurl = item.purl;
    let evalVersion = item.version;

    try {
      const parsed = parsePurl(item.purl);
      if (parsed.version && !evalVersion) {
        evalVersion = parsed.version;
      }
      delete parsed.version;
      basePurl = formatPurl(parsed);
    } catch {
      // Keep item.purl as is if parsing fails
    }

    let rulesCount = 0;
    try {
      rulesCount = rulesFor(basePurl).length;
    } catch {
      rulesCount = 0;
    }

    if (rulesCount === 0) {
      counts.unknown += 1;
      lifecycle.push({
        packageId: item.id,
        name: item.name,
        version: item.version,
        purl: item.purl,
        target: item.target,
        status: "unknown",
      });
      continue;
    }

    let checkOutcome;
    try {
      checkOutcome = check(basePurl, evalVersion, options?.asOf);
    } catch {
      counts.unknown += 1;
      lifecycle.push({
        packageId: item.id,
        name: item.name,
        version: item.version,
        purl: item.purl,
        target: item.target,
        status: "unknown",
      });
      continue;
    }

    if (checkOutcome.status === "end-of-life") {
      counts.endOfLife += 1;
    } else if (checkOutcome.status === "deprecated") {
      counts.deprecated += 1;
    }

    const firstMatch = checkOutcome.matches[0];
    lifecycle.push({
      packageId: item.id,
      name: item.name,
      version: item.version,
      purl: item.purl,
      target: item.target,
      status: checkOutcome.status,
      event: firstMatch?.event,
      deadline: firstMatch?.date ?? null,
      replacement: firstMatch?.replacement ?? null,
      ruleId: firstMatch?.ruleId,
      severity: firstMatch ? "high" : undefined,
    });
  }

  // Provide kebab-case aliases
  counts["end-of-life"] = counts.endOfLife;
  counts["without-purl"] = counts.withoutPurl;

  return {
    scanner: input.scanner,
    scannerVersion: input.scannerVersion,
    target: input.target,
    counts,
    lifecycle,
    warnings: [...input.warnings],
    rawReport: { ...input.rawReport },
  };
}

/**
 * Formats a combined bridge report as a clean Markdown table with counts and findings.
 */
export function formatBridgeMarkdown(report: CombinedBridgeReport): string {
  const lines: string[] = [];
  lines.push(`### Ebb Lifecycle Bridge Summary (${report.scanner})\n`);
  if (report.target) {
    lines.push(`Target: ${report.target}`);
  }
  lines.push(`Scanner: ${report.scanner} (${report.scannerVersion})\n`);

  lines.push("| Metric | Count |");
  lines.push("| :--- | :--- |");
  lines.push(`| **Total Checked** | ${report.counts.checked} |`);
  lines.push(`| ❌ **end-of-life** | ${report.counts.endOfLife} |`);
  lines.push(`| ❌ **deprecated** | ${report.counts.deprecated} |`);
  lines.push(`| ❓ **unknown** | ${report.counts.unknown} |`);
  lines.push(`| ⚠️ **without purl** | ${report.counts.withoutPurl} |`);
  lines.push("");

  if (report.warnings.length > 0) {
    for (const warning of report.warnings) {
      lines.push(`> ⚠️ **Warning**: ${warning}\n`);
    }
  }

  const findings = report.lifecycle.filter(
    (item) =>
      item.status === "end-of-life" ||
      item.status === "deprecated" ||
      item.status === "unsupported" ||
      item.status === "scheduled" ||
      item.status === "removed",
  );

  if (findings.length > 0) {
    lines.push("#### Lifecycle Findings\n");
    lines.push("| Target | Package ID | PURL | Status | Deadline | Replacement |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const f of findings) {
      const statusStr =
        f.status === "end-of-life" || f.status === "deprecated" || f.status === "unsupported" || f.status === "removed"
          ? `❌ ${f.status}`
          : `⚠️ ${f.status}`;
      const purlStr = f.purl ?? "—";
      const deadlineStr = f.deadline ?? "—";
      const replacementStr = f.replacement ?? "—";
      lines.push(`| ${f.target} | ${f.packageId} | ${purlStr} | ${statusStr} | ${deadlineStr} | ${replacementStr} |`);
    }
    lines.push("");
  } else {
    lines.push("No lifecycle issues (end-of-life or deprecated) detected.\n");
  }

  return lines.join("\n");
}
