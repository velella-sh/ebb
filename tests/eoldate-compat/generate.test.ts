import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { RegistryV2Rule } from "../../src/registry.js";
import { writeEolDateApi } from "../../tools/static-api/eoldate.js";

const purl = "pkg:generic/sample";
const rule: RegistryV2Rule = {
  purl,
  id: "sample.end-of-life",
  ecosystem: "nodejs",
  title: "Sample release reaches end of life",
  summary: "Sample release reaches end of life.",
  vers: "vers:semver/>=20.0.0|<21.0.0",
  event: "end-of-life",
  deadline: "2026-03-01",
  severity: "high",
  sources: [{ title: "Vendor", url: "https://vendor.example/releases" }],
  provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-02", reviewer: "reviewer", method: "manual" },
};

test("an Ebb release keeps each support phase, provenance and unknowns distinct", async (t) => {
  const work = await mkdtemp(join(tmpdir(), "ebb-eoldate-fixture-"));
  t.after(() => rm(work, { recursive: true, force: true }));
  const outDir = join(work, "api/eol-compat/v1");
  const source = { date: "2026-01-01", url: "https://endoflife.date/api/v1/products/" };

  await writeEolDateApi({
    outDir,
    baseUrl: "https://example.test/ebb/api/v1",
    createdAt: "2026-04-01T18:01:00Z",
    ids: [
      { purl, id: "sample", source },
      { purl: "pkg:generic/nodata", id: "nodata", source },
    ],
    rules: [
      rule,
      { ...rule, id: "sample.active", deadline: "2026-02-01", event: "end-of-active-support" },
      { ...rule, id: "sample.extended", deadline: "2026-06-01", event: "end-of-extended-support" },
      { ...rule, id: "sample.rule-with-span", vers: "vers:semver/>=5.0.0|<9.0.0" },
      {
        ...rule,
        id: "sample.api-usage",
        vers: "vers:semver/>=50.0.0|<51.0.0",
        usage: [{ kind: "symbol", language: "javascript", symbol: "onlyApi", shape: "reference" }],
      },
      {
        ...rule,
        id: "sample.future-review",
        vers: "vers:semver/>=40.0.0|<41.0.0",
        provenance: { ...rule.provenance, observedAt: "2026-04-02", reviewedAt: "2026-04-02" },
      },
      { ...rule, id: "unmapped", purl: "pkg:generic/unmapped" },
    ],
  });

  const file = await readFile(join(outDir, "products/sample.json"), "utf8");
  const product = JSON.parse(file);
  assert.equal(product.last_modified, "2026-01-02T00:00:00Z");
  assert.deepEqual(product.result.releases, [
    {
      name: "20",
      codename: null,
      label: "20",
      releaseDate: null,
      isLts: null,
      ltsFrom: null,
      isEoas: true,
      eoasFrom: "2026-02-01",
      isEol: true,
      eolFrom: "2026-03-01",
      isDiscontinued: null,
      discontinuedFrom: null,
      isEoes: false,
      eoesFrom: "2026-06-01",
      isMaintained: true,
      latest: null,
      custom: { ebbRuleUrl: "https://example.test/ebb/api/v1/rules/sample.end-of-life.json" },
    },
  ]);
  assert.equal(await readFile(join(outDir, "products/sample"), "utf8"), file);
  assert.deepEqual(await readdir(join(outDir, "products")), ["sample", "sample.json"]);
  assert.deepEqual(JSON.parse(await readFile(join(outDir, "renovate/sample.json"), "utf8")), [
    { cycle: "20", eol: "2026-03-01" },
  ]);
  const index = JSON.parse(await readFile(join(outDir, "products.json"), "utf8"));
  assert.equal(index.total, 1);
  assert.equal(index.result[0].uri, "https://example.test/ebb/api/eol-compat/v1/products/sample.json");
});
