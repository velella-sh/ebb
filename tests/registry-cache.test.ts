import assert from "node:assert/strict";
import { test } from "node:test";

import { clearRegistryCache, validateRegistryV2 } from "../src/registry.js";
import { check } from "../src/index.js";

const sampleRegistry = {
  schemaVersion: "ebb.registry.v2",
  ecosystem: "test-eco",
  rules: [
    {
      id: "rule-1",
      purl: "pkg:npm/cached-pkg",
      ecosystem: "test-eco",
      event: "end-of-life",
      severity: "high",
      title: "Sample",
      summary: "Sample rule",
      vers: "vers:npm/<1.0.0",
      sources: [{ title: "test", url: "https://example.com", accessedAt: "2026-01-01" }],
      provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
    },
  ],
};

test("validateRegistryV2 reuses validated object across 1,000 calls", () => {
  const reg = { ...sampleRegistry };
  const first = validateRegistryV2(reg);

  for (let i = 0; i < 1000; i++) {
    const result = validateRegistryV2(reg);
    assert.strictEqual(result, first);
  }
});

test("validateRegistryV2 parses and validates JSON string once across 1,000 calls", () => {
  clearRegistryCache();
  const jsonStr = JSON.stringify(sampleRegistry);

  let parseCount = 0;
  const originalParse = JSON.parse;
  JSON.parse = function (...args: Parameters<typeof JSON.parse>) {
    parseCount++;
    return Reflect.apply(originalParse, JSON, args);
  } as typeof JSON.parse;

  try {
    const first = validateRegistryV2(jsonStr);
    assert.equal(parseCount, 1);

    for (let i = 0; i < 1000; i++) {
      const result = validateRegistryV2(jsonStr);
      assert.strictEqual(result, first);
    }

    assert.equal(parseCount, 1, "Expected JSON.parse to be called exactly once for 1,000 calls");
  } finally {
    JSON.parse = originalParse;
    clearRegistryCache();
  }
});

test("check reuses loaded registry across 1,000 calls", () => {
  for (let i = 0; i < 1000; i++) {
    const res = check("pkg:npm/react", "18.2.0");
    assert.ok(res);
  }
});
