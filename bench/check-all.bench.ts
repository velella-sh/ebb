/**
 * Benchmark for `checkAll` on 10,000 items generated from bundled rules.
 * Run after `npm run build`:
 *   node bench/check-all.bench.ts                    # Node 24+
 *   node --experimental-strip-types bench/check-all.bench.ts  # Node 22+
 */

import { bundledRules } from "../dist/src/bundled-rules.js";
import { check } from "../dist/src/check.js";
import { type CheckAllItem, type CheckAllSummary, checkAll } from "../dist/src/check-all.js";

const ITEM_COUNT = 10_000;
const TRIALS = 5;

function isVersionRule(usage: readonly { kind: string }[] | undefined): boolean {
  return usage === undefined || usage.some((matcher) => matcher.kind !== "symbol");
}

function buildItems(purls: readonly string[], uniquePairLimit: number): CheckAllItem[] {
  const items = new Array<CheckAllItem>(ITEM_COUNT);
  const sampleVersions = ["0.9.0", "1.0.0", "2.0.0", "18.20.0", "22.12.0"];
  for (let index = 0; index < ITEM_COUNT; index += 1) {
    const slot = index % uniquePairLimit;
    const purl = purls[slot % purls.length]!;
    const cycle = Math.floor(slot / purls.length);
    const version =
      cycle < sampleVersions.length ? sampleVersions[cycle]! : `1.${Math.floor(cycle / 10)}.${cycle % 10}`;
    items[index] = { purl, version };
  }
  return items;
}

function measureScenario(label: string, items: readonly CheckAllItem[]): void {
  const durationsMs: number[] = [];
  let lastSummary: CheckAllSummary | undefined;

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const started = process.hrtime.bigint();
    const { summary } = checkAll(items);
    const elapsedNs = process.hrtime.bigint() - started;
    durationsMs.push(Number(elapsedNs) / 1_000_000);
    lastSummary = summary;
  }

  const sorted = [...durationsMs].sort((left, right) => left - right);
  const medianMs = sorted[Math.floor(sorted.length / 2)]!;
  const minMs = sorted[0]!;
  const maxMs = sorted[sorted.length - 1]!;
  const itemsPerSec = Math.round((ITEM_COUNT / medianMs) * 1_000);

  console.log(
    `${label}: median ${medianMs.toFixed(2)} ms (min ${minMs.toFixed(2)} ms, max ${maxMs.toFixed(2)} ms) ` +
      `| ${itemsPerSec.toLocaleString()} items/s | total=${lastSummary?.total ?? 0}, errors=${lastSummary?.errors ?? 0}`,
  );
}

async function main(): Promise<void> {
  const rules = await bundledRules();
  const seenPurls = new Set<string>();
  const versionRulePurls: string[] = [];
  for (const rule of rules) {
    if (!isVersionRule(rule.usage) || seenPurls.has(rule.purl)) continue;
    seenPurls.add(rule.purl);
    versionRulePurls.push(rule.purl);
  }

  // Warm the active-data index before measuring batch throughput.
  check("pkg:npm/request", "2.88.2");

  const duplicateBatch = buildItems(versionRulePurls, 1_000);
  const uniqueBatch = buildItems(versionRulePurls, ITEM_COUNT);

  console.log(
    `checkAll benchmark (${ITEM_COUNT.toLocaleString()} items, ` +
      `${versionRulePurls.length} real rule PURLs, ${TRIALS} trials, warm index)`,
  );
  measureScenario("realistic SBOM (1,000 unique pairs)", duplicateBatch);
  measureScenario("worst case (10,000 unique pairs)", uniqueBatch);
}

await main();
