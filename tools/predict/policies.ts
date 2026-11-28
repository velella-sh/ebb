import { readFile } from "node:fs/promises";
import { addDays } from "../../src/forecast.js";
import type { EolPrediction, PredictionEvidence } from "../../src/predict.js";
import type { ExpectedEnd } from "../coverage/runtimes.js";
import { daysBetween, endBounds, median, released, type History, type ReleasedLine } from "./history.js";

export interface Policy {
  purl: string;
  successors: number;
  source: string;
  exclude?: string[];
  gapDays?: number;
  schedule?: Array<ExpectedEnd & { line: string; url: string }>;
}

export interface PolicyInput {
  asOf: string;
  policies: Policy[];
  rustReleases: { source: string; dates: Record<string, string> };
}

export type Estimate = Pick<EolPrediction, "method" | "predictedEnd" | "evidence">;

export async function loadPolicies(): Promise<PolicyInput> {
  return JSON.parse(
    await readFile(new URL("../../../tools/predict/policies.json", import.meta.url), "utf8"),
  ) as PolicyInput;
}

/** Rust's coverage fixture uses a single historical range. The upstream release log provides individual dates. */
export function includeRustReleases(histories: readonly History[], input: PolicyInput): History[] {
  const { source, dates } = input.rustReleases;
  const builds = Object.entries(dates).sort((a, b) => a[1].localeCompare(b[1]));
  return histories.map((history) =>
    history.purl !== "pkg:generic/rust"
      ? history
      : {
          ...history,
          scheduleUrl: source,
          sources: [{ url: source, accessedAt: input.asOf, title: "Official Rust release announcements" }],
          lines: builds.map(([id, firstReleased], index) => {
            const next = builds[index + 1];
            const minor = Number(id.split(".")[1]);
            return {
              id,
              firstReleased,
              sampleVersion: id + ".0",
              lineVers: `vers:semver/>=${id}.0|<1.${minor + 1}.0`,
              ...(next
                ? { end: { date: next[1], precision: "day" as const }, status: "ended" as const }
                : { status: "policy" as const }),
            };
          }),
        },
  );
}

export function releaseEvidence(history: History, line: ReleasedLine): PredictionEvidence {
  const source = history.sources.find(({ url }) => url === history.scheduleUrl) ?? history.sources[0];
  if (!source) throw new Error(`No release evidence for ${history.purl}`);
  return {
    kind: "history",
    url: source.url,
    accessedAt: source.accessedAt,
    line: line.id,
    firstReleased: line.firstReleased,
    ...(line.end ? { end: line.end.date } : {}),
  };
}

export function policyFor(history: History, line: ReleasedLine, policies: readonly Policy[]): Policy | undefined {
  return policies.find(({ purl, exclude }) => purl === history.purl && !exclude?.includes(line.id));
}

export function estimatePolicy(
  history: History,
  target: ReleasedLine,
  policy: Policy,
  cutoff: string,
  accessedAt: string,
  schedules = false,
): Estimate | undefined {
  const known = released(history, cutoff);
  const successors = known.filter((line) => line.firstReleased > target.firstReleased);
  const remaining = policy.successors - successors.length;
  if (remaining <= 0) return undefined;

  const evidence: PredictionEvidence[] = [{ kind: "policy", url: policy.source, accessedAt }];
  const planned = (schedules ? (policy.schedule ?? []) : [])
    .filter((release) => endBounds(release)[1] > cutoff && !known.some(({ id }) => id === release.line))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, remaining);
  for (const entry of planned) {
    evidence.push({ kind: "schedule", url: entry.url, accessedAt, line: entry.line, firstReleased: entry.date });
  }

  const anchor = planned.at(-1);
  const last = successors.at(-1) ?? target;
  const [start, finish] = anchor ? endBounds(anchor) : [last.firstReleased, last.firstReleased];
  const missing = remaining - planned.length;
  const middle = addDays(start, Math.round(daysBetween(start, finish) / 2));
  if (missing === 0) {
    return {
      method: "policy",
      predictedEnd: {
        date: middle,
        low: addDays(start, -7),
        high: addDays(finish, 7),
        precision: anchor?.precision ?? "month",
      },
      evidence: [...evidence, ...successors.map((line) => releaseEvidence(history, line))],
    };
  }

  // Use only intervals visible at the cutoff. Recent gaps reflect the current release train.
  const recent = known.slice(-7);
  const gaps = recent.slice(1).map((line, index) => daysBetween(recent[index]!.firstReleased, line.firstReleased));
  if (policy.gapDays === undefined && gaps.length < 3) return undefined;
  const observed = policy.gapDays === undefined ? gaps : [policy.gapDays, ...gaps];
  const point = Math.round(median(observed));
  return {
    method: "policy",
    predictedEnd: {
      date: addDays(middle, missing * point),
      low: addDays(start, Math.max(1, Math.min(...observed) - 14) * missing),
      high: addDays(finish, (Math.max(...observed) + 14) * missing),
      precision: "month",
    },
    evidence: [...evidence, ...recent.map((line) => releaseEvidence(history, line))],
  };
}
