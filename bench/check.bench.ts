/**
 * Benchmark measuring check() latency per component across 1,000 items.
 * Verifies that median time per component is strictly under 1 ms.
 */

import { pathToFileURL } from "node:url";
import { check } from "../dist/src/index.js";
import { type BenchmarkStats, computeStats, printBenchmarkTable } from "./harness.ts";

export const SAMPLE_COMPONENTS: Array<{ purl: string; version: string }> = [
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "pkg:npm/request", version: "2.88.2" },
  { purl: "pkg:npm/react", version: "18.2.0" },
  { purl: "pkg:npm/express", version: "4.18.2" },
  { purl: "pkg:npm/lodash", version: "4.17.21" },
  { purl: "pkg:golang/github.com/gin-gonic/gin", version: "1.9.0" },
  { purl: "pkg:golang/github.com/stretchr/testify", version: "1.8.2" },
  { purl: "pkg:pypi/requests", version: "2.28.0" },
  { purl: "pkg:pypi/django", version: "4.2.0" },
  { purl: "pkg:pypi/flask", version: "2.3.2" },
  { purl: "pkg:cargo/rand", version: "0.8.5" },
  { purl: "pkg:cargo/serde", version: "1.0.160" },
  { purl: "pkg:cargo/tokio", version: "1.28.0" },
  { purl: "pkg:composer/guzzlehttp/guzzle", version: "7.4.0" },
  { purl: "pkg:composer/symfony/console", version: "6.2.0" },
  { purl: "pkg:nuget/Newtonsoft.Json", version: "13.0.1" },
  { purl: "pkg:nuget/Microsoft.Extensions.Logging", version: "7.0.0" },
  { purl: "pkg:maven/org.apache.commons/commons-lang3", version: "3.12.0" },
  { purl: "pkg:maven/com.google.guava/guava", version: "31.1-jre" },
  { purl: "pkg:gem/rails", version: "7.0.4" },
];

export function generate1000Components(): Array<{ purl: string; version: string }> {
  const items: Array<{ purl: string; version: string }> = [];
  for (let i = 0; i < 1000; i++) {
    const base = SAMPLE_COMPONENTS[i % SAMPLE_COMPONENTS.length]!;
    // Introduce variation in versions
    const patch = (i % 20);
    const version = `${base.version.split(".")[0]}.${base.version.split(".")[1] ?? "0"}.${patch}`;
    items.push({ purl: base.purl, version });
  }
  return items;
}

export function profileCheck1000(): BenchmarkStats {
  const items = generate1000Components();

  // Warm up
  for (let i = 0; i < 20; i++) {
    const sample = items[i]!;
    check(sample.purl, sample.version);
  }

  const individualDurationsMs: number[] = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const start = process.hrtime.bigint();
    check(item.purl, item.version);
    const end = process.hrtime.bigint();
    individualDurationsMs[i] = Number(end - start) / 1_000_000;
  }

  return computeStats("check (1,000 components, per-component latency)", individualDurationsMs);
}

export function runCheckBenchmark(): BenchmarkStats {
  const stats = profileCheck1000();
  console.log("\nBenchmark Results:");
  printBenchmarkTable([stats]);

  if (stats.medianMs >= 1.0) {
    throw new Error(`Performance regression: median check time ${stats.medianMs} ms exceeds target of 1.0 ms!`);
  }

  console.log(`\n✔ check median (${stats.medianMs} ms) is strictly under 1.0 ms.`);
  return stats;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  runCheckBenchmark();
}
