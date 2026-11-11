import assert from "node:assert/strict";
import { test } from "node:test";

import { check } from "../src/index.js";

test("check operates well under 1 ms per component", () => {
  // Warm up
  check("pkg:npm/left-pad", "1.3.0");

  const components = [
    { purl: "pkg:npm/left-pad", version: "1.3.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:npm/react", version: "18.2.0" },
    { purl: "pkg:pypi/requests", version: "2.28.0" },
    { purl: "pkg:cargo/rand", version: "0.8.5" },
  ];

  const durations: number[] = [];
  for (let i = 0; i < 500; i++) {
    const comp = components[i % components.length]!;
    const start = process.hrtime.bigint();
    check(comp.purl, comp.version);
    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1e6);
  }

  durations.sort((a, b) => a - b);
  const medianMs = durations[Math.floor(durations.length / 2)]!;

  assert.ok(medianMs < 1.0, `Expected median check time < 1.0 ms, got ${medianMs.toFixed(4)} ms`);
});
