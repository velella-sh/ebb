import assert from "node:assert/strict";
import test from "node:test";

import { enrichSbom } from "../../src/sbom/index.js";

const eol = "cdx:lifecycle:milestone:endOfLife";
const evidenceBase = "https://velella.sh/ebb/api/v1/rules/";

test("CycloneDX enrichment preserves the input, order, unknown fields and unrelated evidence", () => {
  const input = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    dependencies: [{ ref: "app", dependsOn: ["sass"] }],
    metadata: { component: { type: "application", name: "app" } },
    components: [
      {
        name: "node-sass",
        purl: "pkg:npm/node-sass@9.0.0",
        "bom-ref": "sass",
        vendorMetadata: { keep: true },
        properties: [{ name: "environment", value: "build" }],
        externalReferences: [{ type: "website", url: "https://sass-lang.com/" }],
        components: [{ name: "unknown", purl: "pkg:npm/ebb-test-unknown@1.0.0" }],
      },
      { name: "bad PURL", purl: "pkg:%ZZ", version: "1.0.0" },
    ],
  };
  const original = structuredClone(input);
  const result = enrichSbom(input);
  const document = result.document as typeof input;
  const [sass, bad] = document.components;
  assert.deepEqual(result.summary, { checked: 2, enriched: 1, notIdentified: ["app", "bad PURL"] });
  assert.deepEqual(sass?.properties, [
    { name: "environment", value: "build" },
    { name: eol, value: "2024-07-24" },
  ]);
  assert.ok(
    sass?.externalReferences.some(
      (ref) => ref.type === "evidence" && ref.url === `${evidenceBase}npm.package.node-sass.eol.json`,
    ),
  );
  assert.deepEqual(sass?.externalReferences[0], input.components[0]?.externalReferences?.[0]);
  assert.deepEqual(sass?.vendorMetadata, { keep: true });
  assert.deepEqual(sass?.components, original.components[0]?.components);
  assert.deepEqual(bad, original.components[1]);
  assert.deepEqual(document.dependencies, original.dependencies);
  assert.deepEqual(input, original);
  assert.deepEqual(enrichSbom(document), result);
  assert.equal(JSON.stringify(enrichSbom(document).document), JSON.stringify(document));
});

test("CycloneDX refresh retains supplier data and removes milestone values owned by Ebb", () => {
  const input = {
    bomFormat: "CycloneDX",
    specVersion: "1.7",
    components: [
      { name: "Supplier day", purl: "pkg:npm/node-sass@9.0.0", properties: [{ name: eol, value: "2024-07-25" }] },
      { name: "Ebb day", purl: "pkg:npm/node-sass@9.0.0", properties: [{ name: "unrelated", value: "yes" }] },
    ],
  };
  const first = enrichSbom(input).document as typeof input & {
    components: { externalReferences?: unknown[] }[];
  };
  assert.deepEqual(first.components[0]?.properties, input.components[0]?.properties);
  const changed = first.components[1];
  assert.ok(changed);
  changed.purl = "pkg:npm/ebb-test-unknown@9.0.0";
  const refreshed = enrichSbom(first).document as typeof first;
  assert.deepEqual(refreshed.components[1]?.properties, input.components[1]?.properties);
  assert.deepEqual(refreshed.components[1]?.externalReferences, []);
});

test("automatic detection refuses unsupported versions and mismatched options", () => {
  assert.throws(() => enrichSbom({ bomFormat: "CycloneDX", specVersion: "2.0" }), /Expected CycloneDX/);
  assert.throws(() => enrichSbom({ bomFormat: "CycloneDX", specVersion: "1.6" }, "spdx"), /matching --format/);
  assert.throws(
    () => enrichSbom({ bomFormat: "CycloneDX", specVersion: "1.7", components: [null] }),
    /expected objects/,
  );
});
