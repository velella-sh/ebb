import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CheckAllResult } from "../../src/check-all-core.js";
import { buildXeolDocument, formatXeolJson } from "../../src/xeol/output.js";
import type { SyftCheckItem, SyftDocument } from "../../src/xeol/syft.js";

describe("xeol-compat-3: Write xeol-shaped JSON output", () => {
  const dummyDoc: SyftDocument = {
    source: {
      type: "directory",
      target: "/some/path",
    },
    distro: {
      name: "centos",
      version: "8.0",
      idLike: ["centos"],
    },
    descriptor: {
      name: "syft",
      version: "1.10.0",
    },
  };

  const sampleItems: SyftCheckItem[] = [
    {
      id: "pkg-2",
      purl: "pkg:deb/debian/package-2@2.2.2",
      version: "2.2.2",
      artifact: {
        name: "package-2",
        version: "2.2.2",
        type: "deb",
        locations: [{ path: "/foo/bar/somefile-2.txt" }],
        licenses: ["MIT", "Apache-2.0"],
      },
    },
    {
      id: "pkg-1",
      purl: "pkg:rpm/fedora/package-1@1.1.1",
      version: "1.1.1",
      artifact: {
        name: "package-1",
        version: "1.1.1",
        type: "rpm",
        locations: [{ path: "/foo/bar/somefile-1.txt" }],
        licenses: [],
        upstreams: [{ name: "nothing", version: "3.2" }],
        metadataType: "RpmMetadata",
        metadata: { epoch: 2 },
      },
    },
    {
      id: "pkg-3",
      purl: "pkg:generic/ubuntu@16.04",
      version: "16.04",
      artifact: {
        name: "ubuntu",
        version: "16.04",
        type: "os",
      },
    },
  ];

  const sampleOutcome: CheckAllResult = {
    results: [
      {
        schemaVersion: 1,
        version: "2.2.2",
        status: "end-of-life",
        matches: [
          {
            ruleId: "mongodb-2-8",
            event: "end-of-life",
            date: "2016-07-31",
            daysLeft: null,
            replacement: null,
            reviewedAt: "2024-01-01",
            sources: [{ title: "MongoDB EOL", url: "https://example.com/mongodb-eol" }],
          },
        ],
      },
      {
        schemaVersion: 1,
        version: "1.1.1",
        status: "end-of-life",
        matches: [
          {
            ruleId: "mongodb-3-2",
            event: "end-of-life",
            date: "2018-07-31",
            daysLeft: null,
            replacement: null,
            reviewedAt: "2024-01-01",
            sources: [{ title: "MongoDB 3.2 EOL", url: "https://example.com/mongodb-eol-32" }],
          },
        ],
      },
      {
        schemaVersion: 1,
        version: "16.04",
        status: "end-of-life",
        matches: [
          {
            ruleId: "ubuntu-16-04",
            event: "end-of-life",
            date: "2021-04-02",
            daysLeft: null,
            replacement: null,
            reviewedAt: "2024-01-01",
            sources: [{ title: "Ubuntu 16.04 EOL", url: "https://ubuntu.com/16-04-eol" }],
          },
        ],
      },
    ],
    summary: {
      total: 3,
      byStatus: { ok: 0, deprecated: 0, unsupported: 0, "end-of-life": 3, removed: 0, scheduled: 0 },
      byEvent: { deprecated: 0, unsupported: 0, "end-of-life": 3, removed: 0, scheduled: 0 },
      errors: 0,
    },
  };

  it("produces identical top-level structure to xeol JSON document", () => {
    const doc = buildXeolDocument(sampleItems, sampleOutcome, dummyDoc);

    assert.ok(Array.isArray(doc.matches));
    assert.equal(doc.matches.length, 3);
    assert.deepEqual(doc.source, { type: "directory", target: "/some/path" });
    assert.deepEqual(doc.distro, { name: "centos", version: "8.0", idLike: ["centos"] });
    assert.equal(doc.descriptor.name, "ebb");
    assert.ok(doc.descriptor.version);
  });

  it("produces xeol Match shape with Cycle, Package, artifact and isolated ebb object", () => {
    const doc = buildXeolDocument(sampleItems, sampleOutcome, dummyDoc);
    const m = doc.matches[0]!;

    // Top-level match keys
    assert.ok("Cycle" in m);
    assert.ok("Package" in m);
    assert.ok("artifact" in m);
    assert.ok("ebb" in m);

    // Cycle shape
    assert.equal(typeof m.Cycle.ProductName, "string");
    assert.equal(typeof m.Cycle.ReleaseCycle, "string");
    assert.equal(typeof m.Cycle.Eol, "string");
    assert.equal(typeof m.Cycle.LatestRelease, "string");
    assert.equal(typeof m.Cycle.LatestReleaseDate, "string");
    assert.equal(typeof m.Cycle.ReleaseDate, "string");

    // Package shape
    assert.equal(typeof m.Package.ID, "string");
    assert.equal(typeof m.Package.Name, "string");
    assert.equal(typeof m.Package.Version, "string");
    assert.deepEqual(m.Package.Locations, {});
    assert.equal(m.Package.Licenses, null);
    assert.equal(m.Package.CPEs, null);
    assert.equal(m.Package.Upstreams, null);
    assert.equal(m.Package.Metadata, null);

    // Artifact shape
    assert.equal(typeof m.artifact.name, "string");
    assert.equal(typeof m.artifact.version, "string");
    assert.equal(typeof m.artifact.type, "string");
    assert.ok(Array.isArray(m.artifact.locations));
    assert.ok(Array.isArray(m.artifact.licenses));
    assert.ok(Array.isArray(m.artifact.cpes));
    assert.ok(Array.isArray(m.artifact.upstreams));

    // Ebb shape
    assert.ok(m.ebb.ruleId);
    assert.ok(m.ebb.evidence);
    assert.equal(m.ebb.dataVersion, "2");
  });

  it("sorts matches in exact xeol MatchSort order", () => {
    const doc = buildXeolDocument(sampleItems, sampleOutcome, dummyDoc);

    // Names in order: package-1, package-2, ubuntu
    assert.equal(doc.matches[0]!.artifact.name, "package-1");
    assert.equal(doc.matches[1]!.artifact.name, "package-2");
    assert.equal(doc.matches[2]!.artifact.name, "ubuntu");
  });

  it("formats empty document when no matches exist", () => {
    const emptyOutcome: CheckAllResult = {
      results: [
        {
          schemaVersion: 1,
          version: "1.0.0",
          status: "ok",
          matches: [],
        },
      ],
      summary: {
        total: 1,
        byStatus: { ok: 1, deprecated: 0, unsupported: 0, "end-of-life": 0, removed: 0, scheduled: 0 },
        byEvent: { deprecated: 0, unsupported: 0, "end-of-life": 0, removed: 0, scheduled: 0 },
        errors: 0,
      },
    };

    const jsonText = formatXeolJson(sampleItems.slice(0, 1), emptyOutcome);
    const parsed = JSON.parse(jsonText);

    assert.deepEqual(parsed.matches, []);
    assert.deepEqual(parsed.source, { type: "unknown", target: "unknown" });
    assert.equal(parsed.descriptor.name, "ebb");
  });
});
