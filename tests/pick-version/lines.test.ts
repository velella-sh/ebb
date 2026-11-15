import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type SupportedVersionsResult, supportedVersions } from "../../src/index.js";
import type { RegistryV2Rule } from "../../src/registry.js";
import { releaseLineFromVers } from "../../src/rule-versions.js";

function rule(
  fields: Pick<RegistryV2Rule, "id" | "vers" | "event"> & { deadline?: string; purl?: string },
): RegistryV2Rule {
  return {
    id: fields.id,
    ecosystem: "npm",
    purl: fields.purl ?? "pkg:npm/example",
    vers: fields.vers,
    event: fields.event,
    title: fields.id,
    summary: fields.id,
    severity: "high",
    ...(fields.deadline ? { deadline: fields.deadline } : {}),
    sources: [{ title: "Example", url: "https://example.com/rule" }],
    provenance: {
      observedAt: "2026-01-01",
      reviewedAt: "2026-01-01",
      reviewer: "test",
      method: "manual",
    },
  };
}

describe("release lines from VERS ranges", () => {
  it("names a semver major, a pypi minor, and every version", () => {
    assert.equal(releaseLineFromVers("vers:semver/>=20.0.0|<21.0.0")?.id, "20.x");
    assert.equal(releaseLineFromVers("vers:pypi/>=3.11|<3.12")?.id, "3.11");
    assert.equal(releaseLineFromVers("vers:npm/*")?.id, "*");
    assert.equal(releaseLineFromVers("vers:semver/<18.0.0"), undefined);
    assert.equal(releaseLineFromVers("vers:semver/>=20.0.0|<22.0.0"), undefined);
  });

  it("returns a typed empty answer for an unknown package", () => {
    const result: SupportedVersionsResult = supportedVersions("pkg:npm/not-a-real-ebb-package", {
      asOf: "2026-11-15",
    });
    assert.deepEqual(result.lines, []);
    assert.equal(result.complete, false);
    assert.equal(result.recommendation, null);
  });

  it("lists Node.js, Python, and the request package", () => {
    const node = supportedVersions("node", { asOf: "2026-11-15" });
    assert.equal(node.purl, "pkg:generic/nodejs");
    const nodeIds = node.lines.map((line) => line.id);
    assert.deepEqual(nodeIds, ["18.x", "19.x", "20.x", "21.x", "22.x", "23.x", "24.x", "25.x", "26.x"]);
    const node20 = node.lines.find((line) => line.id === "20.x");
    assert.equal(node20?.status, "ended");
    assert.equal(node20?.endDate, "2026-04-30");
    assert.equal(node20?.ruleId, "nodejs.runtime.eol-20");
    assert.equal(node.lines.find((line) => line.id === "22.x")?.event, "scheduled-end-of-life");

    const python = supportedVersions("python", { asOf: "2026-11-15" });
    assert.deepEqual(
      python.lines.map((line) => line.id),
      ["3.11", "3.12", "3.13", "3.14", "3.15"],
    );
    assert.equal(python.lines.find((line) => line.id === "3.11")?.endDate, "2027-10-31");

    const request = supportedVersions("pkg:npm/request", { asOf: "2026-11-15" });
    assert.equal(request.lines.length, 1);
    assert.equal(request.lines[0]?.id, "*");
    assert.equal(request.lines[0]?.status, "ended");
    assert.equal(request.lines[0]?.endDate, "2020-02-11");
    assert.equal(request.lines[0]?.ruleId, "npm.package.request.deprecated");
  });

  it("keeps the most serious event when two rules name one line", () => {
    const result = supportedVersions("pkg:npm/example", {
      asOf: "2026-11-15",
      rules: [
        rule({
          id: "example.scheduled",
          vers: "vers:semver/>=1.0.0|<2.0.0",
          event: "scheduled-end-of-life",
          deadline: "2027-01-01",
        }),
        rule({
          id: "example.ended",
          vers: "vers:semver/>=1.0.0|<2.0.0",
          event: "end-of-life",
          deadline: "2024-01-01",
        }),
      ],
    });
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0]?.ruleId, "example.ended");
    assert.equal(result.lines[0]?.event, "end-of-life");
    assert.equal(result.lines[0]?.status, "ended");
  });
});
