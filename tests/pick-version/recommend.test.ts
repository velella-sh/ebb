import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportedVersions } from "../../src/index.js";
import type { RegistryV2Rule } from "../../src/registry.js";

function rule(fields: Pick<RegistryV2Rule, "id" | "vers" | "event"> & { deadline?: string }): RegistryV2Rule {
  return {
    id: fields.id,
    ecosystem: "npm",
    purl: "pkg:npm/example",
    vers: fields.vers,
    event: fields.event,
    title: fields.id,
    summary: fields.id,
    severity: "low",
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

describe("release line recommendation", () => {
  it("recommends the Node.js line with the latest end date", () => {
    const result = supportedVersions("node", { asOf: "2026-11-15" });
    assert.equal(result.recommendation?.lineId, "26.x");
    assert.match(result.reason, /26\.x/);
    assert.match(result.reason, /2029-04-30/);
    assert.equal(result.lines.find((line) => line.id === "24.x")?.status, "ending");
    assert.equal(result.lines.find((line) => line.id === "20.x")?.status, "ended");
  });

  it("recommends the Python line with the latest end date", () => {
    const result = supportedVersions("python", { asOf: "2026-11-15" });
    assert.equal(result.recommendation?.lineId, "3.15");
    assert.match(result.reason, /2031-10-31/);
  });

  it("recommends nothing for a package whose only line has ended", () => {
    const result = supportedVersions("pkg:npm/request", { asOf: "2026-11-15" });
    assert.equal(result.recommendation, null);
    assert.equal(result.reason, "Every known release line has already ended.");
  });

  it("does not recommend a line that ends within 180 days", () => {
    const result = supportedVersions("pkg:npm/example", {
      asOf: "2026-11-15",
      rules: [
        rule({
          id: "example.soon",
          vers: "vers:semver/>=2.0.0|<3.0.0",
          event: "scheduled-end-of-life",
          deadline: "2026-12-01",
        }),
        rule({
          id: "example.later-but-sooner-than-the-latest",
          vers: "vers:semver/>=1.0.0|<2.0.0",
          event: "scheduled-end-of-life",
          deadline: "2027-01-01",
        }),
      ],
    });
    assert.equal(result.lines.find((line) => line.id === "2.x")?.status, "ending");
    assert.equal(result.recommendation, null);
    assert.match(result.reason, /within 180 days/);
    assert.match(result.reason, /2027-01-01/);
  });

  it("recommends nothing when no line has an end date", () => {
    const result = supportedVersions("pkg:npm/example", {
      asOf: "2026-11-15",
      rules: [
        rule({
          id: "example.open",
          vers: "vers:semver/>=1.0.0|<2.0.0",
          event: "scheduled-end-of-life",
        }),
      ],
    });
    assert.equal(result.lines[0]?.status, "no-known-end");
    assert.equal(result.recommendation, null);
    assert.match(result.reason, /end date/);
  });
});
