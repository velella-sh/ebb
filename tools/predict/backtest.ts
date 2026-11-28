import { pathToFileURL } from "node:url";
import { estimateCadence } from "./cadence.js";
import { daysBetween, endBounds, loadHistory, median, released, type History } from "./history.js";
import {
  estimatePolicy,
  includeRustReleases,
  loadPolicies,
  policyFor,
  type Estimate,
  type PolicyInput,
} from "./policies.js";

export interface BacktestRow {
  purl: string;
  method: Estimate["method"];
  lines: number;
  medianAbsoluteErrorDays: number | null;
  rangeHitRate: number | null;
}

export function backtest(histories: readonly History[], input: PolicyInput): BacktestRow[] {
  const rows: BacktestRow[] = [];
  for (const history of histories) {
    const trials = {
      policy: [] as { error: number; hit: boolean }[],
      cadence: [] as { error: number; hit: boolean }[],
    };
    for (const line of released(history, input.asOf)) {
      if (line.status !== "ended" || !line.end) continue;
      const [low, high] = endBounds(line.end);
      if (high > input.asOf || low < line.firstReleased) continue;
      const cutoff = line.firstReleased;
      const target = { ...line };
      delete target.end;
      const visible = {
        ...history,
        lines: history.lines
          .filter((entry) => !!entry.firstReleased && entry.firstReleased <= cutoff)
          .map((entry) => {
            if (entry.id !== target.id && entry.end && endBounds(entry.end)[1] <= cutoff) return entry;
            const { end: _end, ...withoutEnd } = entry;
            return withoutEnd;
          }),
      };
      const policy = policyFor(visible, target, input.policies);
      const estimates = [
        policy ? estimatePolicy(visible, target, policy, cutoff, input.asOf) : undefined,
        estimateCadence(visible, target, cutoff),
      ];
      for (const estimate of estimates) {
        if (!estimate) continue;
        const p = estimate.predictedEnd;
        const error = p.date < low ? daysBetween(p.date, low) : p.date > high ? daysBetween(high, p.date) : 0;
        trials[estimate.method].push({ error, hit: p.low <= high && low <= p.high });
      }
    }
    for (const [method, estimates] of Object.entries(trials) as [Estimate["method"], typeof trials.policy][]) {
      rows.push({
        purl: history.purl,
        method,
        lines: estimates.length,
        medianAbsoluteErrorDays: estimates.length ? median(estimates.map(({ error }) => error)) : null,
        rangeHitRate: estimates.length ? estimates.filter(({ hit }) => hit).length / estimates.length : null,
      });
    }
  }
  return rows;
}

export function predictionConfidence(row: BacktestRow | undefined): "high" | "medium" | "low" {
  const { rangeHitRate, lines } = row ?? { rangeHitRate: null, lines: 0 };
  if (rangeHitRate === null) return "low";
  if (lines >= 8 && rangeHitRate >= 0.9) return "high";
  return lines >= 4 && rangeHitRate >= 0.75 ? "medium" : "low";
}

export function formatBacktest(rows: readonly BacktestRow[]): string {
  return [
    "| Product | Method | Scored lines | Median absolute error (days) | Range hit rate |",
    "| --- | --- | ---: | ---: | ---: |",
    ...rows.map(
      ({ purl, method, lines, medianAbsoluteErrorDays, rangeHitRate }) =>
        `| ${purl} | ${method} | ${lines} | ${medianAbsoluteErrorDays ?? "—"} | ${rangeHitRate === null ? "—" : (rangeHitRate * 100).toFixed(1) + "%"} |`,
    ),
  ].join("\n");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const input = await loadPolicies();
  console.log(formatBacktest(backtest(includeRustReleases(await loadHistory(), input), input)));
}
