/**
 * Benchmark for `rulesFor` on the largest ecosystem in Ebb's active bundled data.
 * Run after `npm run build`:
 *   node bench/rules-for.bench.ts                              # Node 24+
 *   node --experimental-strip-types bench/rules-for.bench.ts   # Node 22+
 */

import { BUNDLED_ECOSYSTEMS } from "../dist/src/data-bundle.js";
import { getActiveDataSync } from "../dist/src/data-source.js";
import { purlIdentity } from "../dist/src/purl.js";
import { validateRegistryV2 } from "../dist/src/registry.js";
import { type Rule, rulesFor } from "../dist/src/rules-for.js";

const SWEEP_TRIALS = 200;

interface EcosystemStats {
  readonly ecosystem: string;
  readonly ruleCount: number;
  readonly components: readonly string[];
}

function findLargestEcosystem(): EcosystemStats {
  const data = getActiveDataSync();
  let largest: EcosystemStats | undefined;

  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const registry = validateRegistryV2(data.readSync(`registry/${ecosystem}.json`));
    const components: string[] = [];
    const seen = new Set<string>();
    for (const rule of registry.rules) {
      const identity = purlIdentity(rule.purl);
      if (seen.has(identity)) continue;
      seen.add(identity);
      components.push(identity);
    }

    const candidate: EcosystemStats = {
      ecosystem,
      ruleCount: registry.rules.length,
      components,
    };

    if (
      largest === undefined ||
      candidate.ruleCount > largest.ruleCount ||
      (candidate.ruleCount === largest.ruleCount && candidate.components.length > largest.components.length)
    ) {
      largest = candidate;
    }
  }

  if (largest === undefined || largest.components.length === 0) {
    throw new Error("No populated ecosystem found in active data.");
  }
  return largest;
}

function percentile(sorted: readonly number[], ratio: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function main(): void {
  const largest = findLargestEcosystem();

  // Warm the active-data index and sorted-bucket cache before timing.
  let warmRules = 0;
  for (const purl of largest.components) {
    const rules: readonly Rule[] = rulesFor(purl);
    warmRules += rules.length;
  }

  const perLookupMs: number[] = [];
  const perSweepMs: number[] = [];

  for (let trial = 0; trial < SWEEP_TRIALS; trial += 1) {
    const sweepStart = process.hrtime.bigint();
    for (const purl of largest.components) {
      const callStart = process.hrtime.bigint();
      const matched = rulesFor(purl);
      const callElapsed = process.hrtime.bigint() - callStart;
      if (matched.length === 0) {
        throw new Error(`Expected rules for ${purl}`);
      }
      perLookupMs.push(Number(callElapsed) / 1_000_000);
    }
    const sweepElapsed = process.hrtime.bigint() - sweepStart;
    perSweepMs.push(Number(sweepElapsed) / 1_000_000);
  }

  const sortedLookups = [...perLookupMs].sort((left, right) => left - right);
  const sortedSweeps = [...perSweepMs].sort((left, right) => left - right);

  const lookupMedianMs = percentile(sortedLookups, 0.5);
  const lookupP99Ms = percentile(sortedLookups, 0.99);
  const sweepMedianMs = percentile(sortedSweeps, 0.5);
  const sweepP99Ms = percentile(sortedSweeps, 0.99);

  console.log(
    `rulesFor benchmark: largest ecosystem "${largest.ecosystem}" ` +
      `(${largest.ruleCount} rules, ${largest.components.length} components, ${warmRules} matched rules, ${SWEEP_TRIALS} sweeps, warm index)`,
  );
  console.log(
    `  per component lookup: median ${(lookupMedianMs * 1_000).toFixed(2)} us, p99 ${(lookupP99Ms * 1_000).toFixed(2)} us`,
  );
  console.log(`  full ecosystem sweep: median ${sweepMedianMs.toFixed(3)} ms, p99 ${sweepP99Ms.toFixed(3)} ms`);
}

main();
