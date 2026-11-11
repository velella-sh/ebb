import assert from "node:assert/strict";
import { test } from "node:test";
import { BUNDLED_ECOSYSTEMS } from "../src/data-bundle.js";
import type { ActiveData } from "../src/data-source.js";
import { CLE_SCHEMA, exportActiveCle, exportCle } from "../src/export/cle.js";
import type { RegistryV2, RegistryV2Rule } from "../src/registry.js";

function rule(overrides: Partial<RegistryV2Rule>): RegistryV2Rule {
  return {
    id: "r1",
    ecosystem: "npm",
    purl: "pkg:npm/a",
    vers: "vers:npm/<2.0.0",
    event: "end-of-life",
    title: "t",
    summary: "s",
    severity: "high",
    deadline: "2025-01-01",
    sources: [{ title: "s", url: "https://example.com/a", accessedAt: "2025-01-01" }],
    provenance: { observedAt: "2025-01-01", reviewedAt: "2025-01-02", reviewer: "test" },
    ...overrides,
  };
}

test("exportCle groups dated component support/life rules, sorts newest-first, and counts skipped rules", () => {
  const noDeadline = rule({ id: "b.no-deadline" });
  delete noDeadline.deadline;
  const { documents, skipped } = exportCle([
    noDeadline,
    rule({ id: "b.deprecated", event: "deprecated" }),
    rule({
      id: "b.symbol",
      usage: [{ kind: "symbol", language: "javascript", module: "x", symbol: "y", shape: "call" }],
    }),
    rule({
      id: "z.eol",
      purl: "pkg:npm/z",
      event: "end-of-life",
      provenance: { observedAt: "2025-03-01", reviewedAt: "2025-04-01", reviewer: "test" },
    }),
    rule({
      id: "a.eos",
      purl: "pkg:npm/a",
      event: "end-of-support",
      deadline: "2025-06-01",
      provenance: { observedAt: "2025-01-01", reviewedAt: "2025-05-01", reviewer: "test" },
    }),
    rule({
      id: "a.sched",
      purl: "pkg:npm/a",
      event: "scheduled-end-of-life",
      deadline: "2027-01-01",
      severity: "low",
      provenance: { observedAt: "2025-02-01", reviewedAt: "2025-02-01", reviewer: "test" },
    }),
  ]);

  assert.equal(skipped, 3);
  assert.deepEqual(
    documents.map((d) => d.identifier),
    ["pkg:npm/a", "pkg:npm/z"],
  );

  const docA = documents[0]!;
  assert.equal(docA.$schema, CLE_SCHEMA);
  assert.equal(docA.updatedAt, "2025-05-01T00:00:00Z");
  assert.equal(docA.events.length, 2);
  assert.equal(docA.events[0]!.type, "endOfLife");
  assert.equal(docA.events[0]!.id, 2);
  assert.equal(docA.events[1]!.type, "endOfSupport");
  assert.equal(docA.events[1]!.supportId, "ebb");
  assert.equal(docA.definitions?.support[0]?.id, "ebb");

  const docZ = documents[1]!;
  assert.equal(docZ.definitions, undefined);
});

test("exportActiveCle reads validated registries from the supplied ActiveData", async () => {
  const emptyRegistry = (ecosystem: string): RegistryV2 => ({
    schemaVersion: "ebb.registry.v2",
    ecosystem,
    rules:
      ecosystem === "nodejs"
        ? [rule({ id: "node.eol", ecosystem: "nodejs", purl: "pkg:generic/nodejs", vers: "vers:semver/<18" })]
        : [],
  });
  const activeData: ActiveData = {
    info: {
      source: "bundled",
      version: "0.1.1",
      createdAt: null,
      contentDigest: null,
      reviewedThrough: "2026-01-01",
      signer: null,
      warnings: [],
    },
    readSync: (path) => {
      const ecosystem = path.replace(/^registry\//, "").replace(/\.json$/, "");
      assert.ok((BUNDLED_ECOSYSTEMS as readonly string[]).includes(ecosystem));
      return emptyRegistry(ecosystem);
    },
    async read(path) {
      return this.readSync(path);
    },
  };

  const result = await exportActiveCle(activeData);
  assert.equal(result.skipped, 0);
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0]!.identifier, "pkg:generic/nodejs");
});
