import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportedVersions } from "../../src/index.js";
import type { RegistryV2Rule } from "../../src/registry.js";

function rule(id: string, vers: string, deadline: string): RegistryV2Rule {
  return {
    id,
    ecosystem: "npm",
    purl: "pkg:npm/example",
    vers,
    event: "scheduled-end-of-life",
    title: id,
    summary: id,
    severity: "low",
    deadline,
    sources: [{ title: "Example", url: "https://example.com/rule" }],
    provenance: {
      observedAt: "2026-01-01",
      reviewedAt: "2026-01-01",
      reviewer: "test",
      method: "manual",
    },
  };
}

describe("completeness of release lines", () => {
  it("marks a contiguous runtime complete and still notes versions past the last rule", () => {
    const node = supportedVersions("node", { asOf: "2026-11-15" });
    assert.equal(node.complete, true);
    assert.ok(node.notes.some((note) => note.includes("newer than 26.x")));
    assert.ok(node.notes.some((note) => note.includes("nodejs.runtime.legacy")));

    const python = supportedVersions("python", { asOf: "2026-11-15" });
    assert.equal(python.complete, true);
    assert.ok(python.notes.some((note) => note.includes("newer than 3.15")));
  });

  it("marks a gap as incomplete and does not call the missing line supported", () => {
    const result = supportedVersions("pkg:npm/example", {
      asOf: "2026-11-15",
      rules: [
        rule("example.1", "vers:semver/>=1.0.0|<2.0.0", "2024-01-01"),
        rule("example.3", "vers:semver/>=3.0.0|<4.0.0", "2030-01-01"),
      ],
    });
    assert.equal(result.complete, false);
    assert.deepEqual(
      result.lines.map((line) => line.id),
      ["1.x", "3.x"],
    );
    assert.ok(result.notes.some((note) => note === "No rule covers 2.x."));
    assert.equal(result.recommendation?.lineId, "3.x");
    assert.match(result.reason, /incomplete/);
    assert.equal(
      result.lines.some((line) => line.id === "2.x"),
      false,
    );
  });

  it("returns an explicit empty answer for an unknown component", () => {
    const byPurl = supportedVersions("pkg:npm/not-a-real-ebb-package", { asOf: "2026-11-15" });
    assert.equal(byPurl.purl, "pkg:npm/not-a-real-ebb-package");
    assert.deepEqual(byPurl.lines, []);
    assert.equal(byPurl.complete, false);
    assert.equal(byPurl.recommendation, null);
    assert.ok(byPurl.notes.some((note) => note.includes("no rules")));

    const byName = supportedVersions("not-a-real-ebb-product", { asOf: "2026-11-15" });
    assert.equal(byName.purl, null);
    assert.deepEqual(byName.lines, []);
    assert.equal(byName.complete, false);
  });
});
