import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { type CheckAllItem, checkAll, isCheckAllError } from "../../src/check-all.js";

interface CycloneDxComponent {
  readonly name: string;
  readonly version?: string;
  readonly purl?: string;
}

interface CycloneDxBom {
  readonly bomFormat: string;
  readonly specVersion: string;
  readonly components: readonly CycloneDxComponent[];
}

const sbomFixtureUrl = new URL("../../../tests/check-all/fixtures/sbom.json", import.meta.url);

function toCheckAllItems(components: readonly CycloneDxComponent[]): CheckAllItem[] {
  return components.map((component) => ({
    purl: component.purl ?? component.name,
    version: component.version ?? "",
  }));
}

test("checkAll evaluates a CycloneDX component list preserving order and summary counts", async () => {
  const raw = await readFile(sbomFixtureUrl, "utf8");
  const bom = JSON.parse(raw) as CycloneDxBom;

  assert.equal(bom.bomFormat, "CycloneDX");
  assert.equal(bom.components.length, 7);

  const { results, summary } = checkAll(toCheckAllItems(bom.components));

  assert.equal(results.length, bom.components.length);
  assert.deepEqual(
    results.map((entry) => entry.status),
    ["ok", "deprecated", "end-of-life", "unsupported", "scheduled", "deprecated", "ok"],
  );
  // Duplicate request@2.88.2 component reuses the cached result object.
  assert.equal(results[1], results[5]);

  assert.equal(summary.total, 7);
  assert.equal(summary.errors, 0);
  assert.deepEqual(summary.byStatus, {
    ok: 2,
    deprecated: 2,
    unsupported: 1,
    "end-of-life": 1,
    removed: 0,
    scheduled: 1,
  });
  assert.ok(summary.byEvent.deprecated >= 3);
  assert.equal(summary.byEvent["end-of-life"], 1);
  assert.equal(summary.byEvent.unsupported, 1);
  assert.equal(summary.byEvent.scheduled, 1);
});

test("checkAll handles CycloneDX components with invalid PURL or missing version without aborting", async () => {
  const raw = await readFile(sbomFixtureUrl, "utf8");
  const bom = JSON.parse(raw) as CycloneDxBom;

  const components: CycloneDxComponent[] = [
    ...bom.components.slice(0, 2),
    { name: "broken-purl-component", version: "1.0.0", purl: "pkg:" },
    { name: "missing-version-component", purl: "pkg:npm/express" },
    bom.components[2]!,
  ];

  function* streamComponents(): Generator<CheckAllItem> {
    for (const component of components) {
      yield { purl: component.purl ?? component.name, version: component.version ?? "" };
    }
  }

  const { results, summary } = checkAll(streamComponents());

  assert.equal(results.length, 5);
  assert.equal(results[0]?.status, "ok");
  assert.equal(results[1]?.status, "deprecated");
  assert.ok(results[2] && isCheckAllError(results[2]));
  assert.equal(results[2].index, 2);
  assert.equal(results[2].code, "invalid-purl");
  assert.ok(results[3] && isCheckAllError(results[3]));
  assert.equal(results[3].index, 3);
  assert.equal(results[3].code, "invalid-version");
  assert.equal(results[4]?.status, "end-of-life");

  assert.equal(summary.total, 5);
  assert.equal(summary.errors, 2);
  assert.equal(summary.byStatus.ok, 1);
  assert.equal(summary.byStatus.deprecated, 1);
  assert.equal(summary.byStatus["end-of-life"], 1);
});
