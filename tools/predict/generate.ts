import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { isDatedEnd, type EolPrediction, type PredictionTable } from "../../src/predict.js";
import type { RegistryV2Rule } from "../../src/registry.js";
import { ruleCoversLineRange } from "../../src/rule-versions.js";
import { loadRegistryRulesForRoot } from "../coverage/runtimes.js";
import { backtest, predictionConfidence } from "./backtest.js";
import { estimateCadence } from "./cadence.js";
import { loadHistory, released, type History } from "./history.js";
import { estimatePolicy, includeRustReleases, loadPolicies, policyFor, type PolicyInput } from "./policies.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
export const predictionFile = "registry/tables/predictions.json";
const modelVersion = "1.0.0";

export function predictTable(
  rawHistory: readonly History[],
  input: PolicyInput,
  rulesByPurl: ReadonlyMap<string, readonly RegistryV2Rule[]>,
): PredictionTable {
  const histories = includeRustReleases(rawHistory, input);
  const scores = backtest(histories, input);
  const dataVersion = input.asOf.replaceAll("-", ".");
  const predictions: EolPrediction[] = [];
  const relevantRules = [...rulesByPurl].map(([purl, rules]) => [
    purl,
    rules.filter(isDatedEnd).map(({ id, vers, deadline }) => [id, vers, deadline]),
  ]);
  for (const history of histories) {
    const dated = (rulesByPurl.get(history.purl) ?? []).filter(isDatedEnd);
    for (const line of released(history, input.asOf)) {
      if (line.end || line.status === "ended") continue;
      if (dated.some((rule) => ruleCoversLineRange(rule.vers, line.lineVers))) continue;
      const policy = policyFor(history, line, input.policies);
      // Excluded lines have a distinct support class (e.g. Java LTS). Do not borrow the feature-release cadence.
      if (!policy && input.policies.some(({ purl }) => purl === history.purl)) continue;
      const estimate = policy
        ? estimatePolicy(history, line, policy, input.asOf, input.asOf, true)
        : estimateCadence(history, line, input.asOf);
      if (!estimate || estimate.predictedEnd.high <= input.asOf) continue;
      predictions.push({
        purl: history.purl,
        line: line.id,
        lineVers: line.lineVers,
        ...estimate,
        confidence: predictionConfidence(
          scores.find((row) => row.purl === history.purl && row.method === estimate.method),
        ),
        modelVersion,
        dataVersion,
      });
    }
  }
  predictions.sort((a, b) =>
    a.purl === b.purl ? a.line.localeCompare(b.line, "en") : a.purl.localeCompare(b.purl, "en"),
  );
  const inputSha256 = createHash("sha256")
    .update(JSON.stringify([rawHistory, input, relevantRules]))
    .digest("hex");
  return { schemaVersion: "ebb.prediction.v1", dataVersion, inputSha256, predictions };
}

export async function generatePredictions(rootPath = root): Promise<string> {
  const [histories, input] = await Promise.all([
    loadHistory(join(rootPath, "tools/coverage/expected")),
    loadPolicies(),
  ]);
  const entries = await Promise.all(
    histories.map(
      async ({ purl, registry }) => [purl, await loadRegistryRulesForRoot(rootPath, registry, purl)] as const,
    ),
  );
  const table = predictTable(histories, input, new Map(entries));
  const schema = JSON.parse(await readFile(join(rootPath, "schemas/prediction.v1.schema.json"), "utf8"));
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  if (!validate(table)) throw new Error(`Invalid prediction table: ${JSON.stringify(validate.errors)}`);
  return JSON.stringify(table, null, 2) + "\n";
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const file = join(root, predictionFile);
  await writeFile(file, await generatePredictions());
  console.log(`Wrote ${predictionFile}`);
}
