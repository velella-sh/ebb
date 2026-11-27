/**
 * OpenMetrics formatter for Ebb CLI results (check-all and upcoming).
 * Produces valid OpenMetrics text format (RFC / OpenMetrics 1.0.0)
 * with bounded label cardinality and # EOF termination.
 */

import type { CheckAllResult, CheckAllItem } from "../../check-all.js";
import { isCheckAllError } from "../../check-all.js";
import type { UpcomingResult } from "../../upcoming.js";
import type { DataStatus } from "../../data-status.js";
import { dataStatus as getDataStatus } from "../../data-status.js";
import { formatPurl, parsePurl } from "../../purl.js";

export interface OpenMetricsFormatOptions {
  dataStatus?: DataStatus | undefined;
  asOf?: string | undefined;
}

/**
 * Escapes label values according to OpenMetrics 1.0.0 specification:
 * Backslash (\), double-quote ("), and line feed (\n) must be escaped.
 */
export function escapeOpenMetricsLabel(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

interface MetricSample {
  labels: string;
  value: number;
}

function normalizePurlAndVersion(rawPurl: string, rawVersion?: string): { purl: string; version: string } {
  let purl = rawPurl;
  let version = rawVersion || "";

  if (!version && purl.includes("@")) {
    const atIdx = purl.lastIndexOf("@");
    version = purl.slice(atIdx + 1);
    purl = purl.slice(0, atIdx);
  }

  try {
    const parsed = parsePurl(purl);
    if (!version && parsed.version) {
      version = parsed.version;
    }
    if (parsed.version) {
      delete parsed.version;
      purl = formatPurl(parsed);
    }
  } catch {
    // Keep purl and version as extracted
  }

  return { purl, version };
}

function buildMetricOutput(
  daysLeftSamples: MetricSample[],
  statusSamples: MetricSample[],
  options?: OpenMetricsFormatOptions,
): string {
  const lines: string[] = [];

  // Sort samples deterministically by label string
  daysLeftSamples.sort((a, b) => a.labels.localeCompare(b.labels));
  statusSamples.sort((a, b) => a.labels.localeCompare(b.labels));

  if (daysLeftSamples.length > 0) {
    lines.push("# HELP ebb_component_days_left Days remaining until component lifecycle event deadline.");
    lines.push("# TYPE ebb_component_days_left gauge");
    for (const sample of daysLeftSamples) {
      lines.push(`ebb_component_days_left{${sample.labels}} ${sample.value}`);
    }
  }

  if (statusSamples.length > 0) {
    lines.push("# HELP ebb_component_status Lifecycle verdict of the software component (1 for active status).");
    lines.push("# TYPE ebb_component_status gauge");
    for (const sample of statusSamples) {
      lines.push(`ebb_component_status{${sample.labels}} ${sample.value}`);
    }
  }

  const statusInfo = options?.dataStatus ?? getDataStatus({ now: options?.asOf });
  const ageSeconds = Math.max(0, Math.floor(statusInfo.ageDays * 86400));

  lines.push("# HELP ebb_data_age_seconds Age of the active lifecycle data in seconds.");
  lines.push("# TYPE ebb_data_age_seconds gauge");
  lines.push(`ebb_data_age_seconds ${ageSeconds}`);

  lines.push("# EOF");
  return `${lines.join("\n")}\n`;
}

/**
 * Format batch check-all outcome into OpenMetrics text format.
 */
export function formatCheckAllOpenMetrics(
  items: CheckAllItem[],
  outcome: CheckAllResult,
  options?: OpenMetricsFormatOptions,
): string {
  const daysLeftMap = new Map<string, MetricSample>();
  const statusMap = new Map<string, MetricSample>();

  for (let i = 0; i < outcome.results.length; i++) {
    const res = outcome.results[i]!;
    const item = items[i];
    const { purl, version } = normalizePurlAndVersion(item?.purl ?? "", item?.version);

    let status = "ok";
    let event = "none";
    let daysLeft: number | null = null;

    if (isCheckAllError(res)) {
      status = "error";
      event = "none";
    } else {
      status = res.status;
      if (res.matches && res.matches.length > 0) {
        event = res.matches[0]!.event;
        for (const m of res.matches) {
          if (m.daysLeft !== null && m.daysLeft !== undefined && m.daysLeft >= 0) {
            if (daysLeft === null || m.daysLeft < daysLeft) {
              daysLeft = m.daysLeft;
            }
          }
        }
      }
    }

    // Lexicographically sorted label names: event, purl, status, version
    const labels = `event="${escapeOpenMetricsLabel(event)}",purl="${escapeOpenMetricsLabel(purl)}",status="${escapeOpenMetricsLabel(status)}",version="${escapeOpenMetricsLabel(version)}"`;

    if (!statusMap.has(labels)) {
      statusMap.set(labels, { labels, value: 1 });
    }

    if (daysLeft !== null) {
      if (!daysLeftMap.has(labels)) {
        daysLeftMap.set(labels, { labels, value: daysLeft });
      }
    }
  }

  return buildMetricOutput(Array.from(daysLeftMap.values()), Array.from(statusMap.values()), options);
}

/**
 * Format upcoming result into OpenMetrics text format.
 */
export function formatUpcomingOpenMetrics(result: UpcomingResult, options?: OpenMetricsFormatOptions): string {
  const daysLeftMap = new Map<string, MetricSample>();
  const statusMap = new Map<string, MetricSample>();

  for (const item of result.items) {
    const { purl, version: extractedVersion } = normalizePurlAndVersion(item.purl);
    const version = extractedVersion || "*";
    const status = "scheduled";
    const event = item.event;

    // Lexicographically sorted label names: event, purl, status, version
    const labels = `event="${escapeOpenMetricsLabel(event)}",purl="${escapeOpenMetricsLabel(purl)}",status="${escapeOpenMetricsLabel(status)}",version="${escapeOpenMetricsLabel(version)}"`;

    if (!statusMap.has(labels)) {
      statusMap.set(labels, { labels, value: 1 });
    }

    if (item.daysLeft !== null && item.daysLeft !== undefined && item.daysLeft >= 0) {
      if (!daysLeftMap.has(labels)) {
        daysLeftMap.set(labels, { labels, value: item.daysLeft });
      }
    }
  }

  return buildMetricOutput(Array.from(daysLeftMap.values()), Array.from(statusMap.values()), options);
}
