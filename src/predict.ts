import { readFileSync } from "node:fs";
import { findPackageFileSync } from "./package-files.js";
import { normalizePurl, purlIdentity } from "./purl.js";
import { ruleCoversLineRange } from "./rule-versions.js";
import { rulesFor } from "./rules-for.js";
import type { RegistryV2Rule } from "./registry.js";
import { versContains } from "./vers.js";

export interface PredictionEvidence {
  readonly kind: "policy" | "schedule" | "history";
  readonly url: string;
  readonly accessedAt: string;
  readonly line?: string;
  readonly firstReleased?: string;
  readonly end?: string;
}

export interface EolPrediction {
  readonly purl: string;
  readonly line: string;
  readonly lineVers: string;
  readonly predictedEnd: {
    readonly date: string;
    readonly low: string;
    readonly high: string;
    readonly precision: "day" | "month";
  };
  readonly confidence: "high" | "medium" | "low";
  readonly method: "policy" | "cadence";
  readonly evidence: readonly PredictionEvidence[];
  readonly modelVersion: string;
  readonly dataVersion: string;
}

export interface PredictionTable {
  readonly schemaVersion: "ebb.prediction.v1";
  readonly dataVersion: string;
  readonly inputSha256: string;
  readonly predictions: readonly EolPrediction[];
}

export function isDatedEnd(rule: RegistryV2Rule): boolean {
  return (
    !!rule.deadline &&
    (rule.event === "end-of-life" || rule.event === "scheduled-end-of-life" || rule.event === "end-of-support") &&
    !rule.usage?.some((matcher) => matcher.kind === "symbol")
  );
}

let table: PredictionTable | undefined;
function predictionTable(): PredictionTable {
  return (table ??= JSON.parse(
    readFileSync(findPackageFileSync("registry/tables/predictions.json", import.meta.url), "utf8"),
  ) as PredictionTable);
}

/** Planning data for one component, separate from authoritative lifecycle results. */
export function predictions(purl: string): EolPrediction[] {
  const identity = purlIdentity(normalizePurl(purl));
  const candidates = predictionTable().predictions.filter((prediction) => prediction.purl === identity);
  if (candidates.length === 0) return [];
  const dated = rulesFor(identity).filter(isDatedEnd);
  return candidates.filter(({ lineVers }) => !dated.some((rule) => ruleCoversLineRange(rule.vers, lineVers)));
}

/** Return the estimate for a version unless an active rule already provides an end date. */
export function predictEol(purl: string, version: string): EolPrediction | null {
  const prediction = predictions(purl).find(({ lineVers }) => versContains(lineVers, version));
  if (!prediction || rulesFor(prediction.purl).some((rule) => isDatedEnd(rule) && versContains(rule.vers, version)))
    return null;
  return prediction;
}
