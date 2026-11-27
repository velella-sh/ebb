import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { RegistryV2Rule } from "../../src/registry.js";
import { writeRenovateFeeds } from "../../tools/static-api/renovate.js";

const FIXTURE_RULES: RegistryV2Rule[] = [
  // Component 1: Node.js with multiple release lines
  {
    id: "nodejs.runtime.eol-18",
    ecosystem: "generic",
    purl: "pkg:generic/nodejs",
    vers: "vers:semver/>=18.0.0|<19.0.0",
    event: "end-of-life",
    deadline: "2025-04-30",
    title: "Node.js 18 end-of-life",
    summary: "Node.js 18 reached end-of-life on 2025-04-30.",
    severity: "high",
    sources: [
      { title: "Node.js Releases", url: "https://nodejs.org/en/about/previous-releases" },
      { title: "Node.js GitHub Repository", url: "https://github.com/nodejs/node" },
    ],
    provenance: { observedAt: "2025-05-01", reviewedAt: "2025-05-01", reviewer: "arminazimi", method: "manual" },
  },
  {
    id: "nodejs.runtime.eol-20",
    ecosystem: "generic",
    purl: "pkg:generic/nodejs",
    vers: "vers:semver/>=20.0.0|<21.0.0",
    event: "end-of-life",
    deadline: "2026-04-30",
    title: "Node.js 20 end-of-life",
    summary: "Node.js 20 reached end-of-life on 2026-04-30.",
    severity: "high",
    sources: [{ title: "Node.js Releases", url: "https://nodejs.org/en/about/previous-releases" }],
    provenance: { observedAt: "2026-05-01", reviewedAt: "2026-05-01", reviewer: "arminazimi", method: "manual" },
  },
  {
    id: "nodejs.runtime.eol-22",
    ecosystem: "generic",
    purl: "pkg:generic/nodejs",
    vers: "vers:semver/>=22.0.0|<23.0.0",
    event: "scheduled-end-of-life",
    deadline: "2027-04-30",
    title: "Node.js 22 scheduled end-of-life",
    summary: "Node.js 22 is scheduled to reach end-of-life on 2027-04-30.",
    severity: "low",
    sources: [{ title: "Node.js Releases", url: "https://nodejs.org/en/about/previous-releases" }],
    provenance: { observedAt: "2026-05-01", reviewedAt: "2026-05-01", reviewer: "arminazimi", method: "manual" },
  },
  // Component 2: Open range rule without release lines
  {
    id: "generic.open-range",
    ecosystem: "generic",
    purl: "pkg:generic/no-lines-package",
    vers: "vers:semver/<35.0.0",
    event: "end-of-life",
    deadline: "2024-01-01",
    title: "Legacy versions ended",
    summary: "Versions below 35 are obsolete.",
    severity: "medium",
    sources: [{ title: "Vendor Announcement", url: "https://example.com/announcement" }],
    provenance: { observedAt: "2024-01-01", reviewedAt: "2024-01-01", reviewer: "arminazimi", method: "manual" },
  },
];

test("writeRenovateFeeds generates one feed file per component with release lines", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "ebb-renovate-feed-test-"));
  try {
    const result = await writeRenovateFeeds({
      outDir: tempDir,
      rules: FIXTURE_RULES,
      baseUrl: "https://velella.sh/ebb/api/v1",
      createdAt: "2026-11-27T00:00:00Z",
    });

    // Node.js should have a feed
    assert.equal(result.feeds.size, 1);
    const nodeFeedInfo = result.feeds.get("pkg:generic/nodejs");
    assert.ok(nodeFeedInfo, "pkg:generic/nodejs feed info must be registered");
    assert.equal(nodeFeedInfo.path, "renovate/generic/nodejs.json");
    assert.equal(nodeFeedInfo.url, "https://velella.sh/ebb/api/v1/renovate/generic/nodejs.json");
    assert.equal(nodeFeedInfo.releasesCount, 3);
    assert.equal(nodeFeedInfo.deprecatedCount, 2); // 18.x and 20.x ended before 2026-11-27

    // Component without release lines is omitted with documented reason
    assert.equal(result.omitted.length, 1);
    assert.equal(result.omitted[0]?.purl, "pkg:generic/no-lines-package");
    assert.ok(result.omitted[0]?.reason.length > 0);

    // Read and verify the feed JSON shape
    const feedJson = await readFile(join(tempDir, nodeFeedInfo.path), "utf8");
    const feedDoc = JSON.parse(feedJson) as {
      releases: Array<{ version: string; isDeprecated: boolean }>;
      homepage?: string;
      sourceUrl?: string;
    };

    assert.ok(Array.isArray(feedDoc.releases), "Feed must have releases array");
    assert.equal(feedDoc.releases.length, 3);

    // Verify release deprecation statuses against reference date 2026-11-27
    const rel18 = feedDoc.releases.find((r) => r.version === "18.x");
    assert.ok(rel18, "18.x must exist");
    assert.equal(rel18.isDeprecated, true, "18.x must be deprecated (ended 2025-04-30)");

    const rel20 = feedDoc.releases.find((r) => r.version === "20.x");
    assert.ok(rel20, "20.x must exist");
    assert.equal(rel20.isDeprecated, true, "20.x must be deprecated (ended 2026-04-30)");

    const rel22 = feedDoc.releases.find((r) => r.version === "22.x");
    assert.ok(rel22, "22.x must exist");
    assert.equal(rel22.isDeprecated, false, "22.x must not be deprecated (ends 2027-04-30)");

    // Verify metadata URLs
    assert.equal(feedDoc.homepage, "https://nodejs.org");
    assert.equal(feedDoc.sourceUrl, "https://github.com/nodejs/node");

    // Scope check: no invented versions that no rule or release line names
    const versionNames = feedDoc.releases.map((r) => r.version);
    assert.deepEqual(versionNames, ["18.x", "20.x", "22.x"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
