import assert from "node:assert/strict";
import { test } from "node:test";

import { buildProductPurlIndex, buildPurlIndex, lookupByPurl } from "../src/index-build.js";
import type { ProductRecord } from "../src/product-name.js";
import type { RegistryV2Rule } from "../src/registry.js";

const sampleRules: RegistryV2Rule[] = [
  {
    id: "RULE-1",
    purl: "pkg:npm/example",
    ecosystem: "npm",
    event: "end-of-life",
    severity: "high",
    title: "Example EOL",
    summary: "Example summary",
    vers: "vers:npm/<1.0.0",
    sources: [{ title: "test", url: "https://example.com" }],
    provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
  },
  {
    id: "RULE-2",
    purl: "pkg:npm/example?repository_url=https://github.com/foo/bar",
    ecosystem: "npm",
    event: "deprecated",
    severity: "medium",
    title: "Example Deprecated",
    summary: "Example summary 2",
    vers: "vers:npm/>=1.0.0",
    sources: [{ title: "test", url: "https://example.com" }],
    provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
  },
  {
    id: "RULE-3",
    purl: "pkg:pypi/other-lib",
    ecosystem: "pypi",
    event: "end-of-life",
    severity: "low",
    title: "Other lib EOL",
    summary: "Other summary",
    vers: "vers:pypi/<2.0.0",
    sources: [{ title: "test", url: "https://example.com" }],
    provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-01", reviewer: "test" },
  },
];

test("buildPurlIndex groups rules by canonical purl identity", () => {
  const index = buildPurlIndex(sampleRules);
  assert.equal(index.size, 2);
  const npmRules = index.get("pkg:npm/example");
  assert.ok(npmRules);
  assert.equal(npmRules.length, 2);
  assert.equal(npmRules[0]?.id, "RULE-1");
  assert.equal(npmRules[1]?.id, "RULE-2");

  const pypiRules = index.get("pkg:pypi/other-lib");
  assert.ok(pypiRules);
  assert.equal(pypiRules.length, 1);
});

test("lookupByPurl matches normal and parameterized PURLs", () => {
  const index = buildPurlIndex(sampleRules);
  const found = lookupByPurl(index, "pkg:npm/example@1.0.0?arch=x64#subpath");
  assert.ok(found);
  assert.equal(found.length, 2);

  const missing = lookupByPurl(index, "pkg:npm/nonexistent");
  assert.equal(missing, undefined);

  const invalid = lookupByPurl(index, "not-a-purl");
  assert.equal(invalid, undefined);
});

test("buildProductPurlIndex indexes products by purl identity", () => {
  const products: ProductRecord[] = [
    {
      id: "npm-example",
      purl: "pkg:npm/example",
      name: "example",
      ecosystems: ["npm"],
      aliases: new Set(["example"]),
      rules: [sampleRules[0]!],
    },
  ];
  const productIndex = buildProductPurlIndex(products);
  assert.equal(productIndex.size, 1);
  assert.ok(productIndex.get("pkg:npm/example"));
});
