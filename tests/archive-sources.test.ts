import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  calculateArchiveCoverage,
  formatArchiveCoverageMarkdown,
  formatArchiveTodayUrl,
  formatWaybackTimestamp,
  formatWaybackUrl,
  submitToWayback,
} from "../tools/archive-sources.js";
import { sourcesOf } from "../src/sources-of.js";
import type { RegistryV2Rule } from "../src/registry.js";

describe("archive-sources tool", () => {
  it("formats wayback timestamp and snapshot URLs correctly", () => {
    assert.equal(formatWaybackTimestamp("2026-11-07"), "20261107000000");
    const formatted = formatWaybackUrl("https://example.com/docs", "2026-11-07");
    assert.equal(formatted, "https://web.archive.org/web/20261107000000/https://example.com/docs");

    const fallback = formatArchiveTodayUrl("https://example.com/docs");
    assert.equal(fallback, "https://archive.today/newest/https://example.com/docs");
  });

  it("submits source to wayback machine with mock server success", async () => {
    const server = createServer((req, res) => {
      if (req.url?.includes("/save/")) {
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Content-Location": "/web/20261114120000/https://example.com/guide",
        });
        res.end("<html>Saved</html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const waybackBaseUrl = `http://127.0.0.1:${port}/save/`;

    try {
      const result = await submitToWayback("https://example.com/guide", {
        waybackBaseUrl,
        date: "2026-11-14",
      });

      assert.equal(result.status, "ok");
      assert.equal(result.service, "wayback");
      assert.equal(result.archiveUrl, "https://web.archive.org/web/20261114120000/https://example.com/guide");
      assert.equal(result.archivedAt, "2026-11-14");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("retries with backoff on HTTP 429 and succeeds", async () => {
    let attempts = 0;
    const server = createServer((_req, res) => {
      attempts++;
      if (attempts === 1) {
        res.writeHead(429, {
          "Retry-After": "1",
        });
        res.end("Rate limited");
      } else {
        res.writeHead(200, {
          Location: "https://web.archive.org/web/20261114150000/https://example.com/rate-limited",
        });
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const waybackBaseUrl = `http://127.0.0.1:${port}/save/`;

    try {
      let slept = 0;
      const result = await submitToWayback("https://example.com/rate-limited", {
        waybackBaseUrl,
        sleepFn: async (ms) => {
          slept += ms;
        },
      });

      assert.equal(attempts, 2);
      assert.equal(result.status, "ok");
      assert.equal(result.service, "wayback");
      assert.equal(result.archiveUrl, "https://web.archive.org/web/20261114150000/https://example.com/rate-limited");
      assert.ok(slept >= 1000);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("falls back to archive.today when Wayback Machine fails repeatedly", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(503);
      res.end("Service Unavailable");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const waybackBaseUrl = `http://127.0.0.1:${port}/save/`;

    try {
      const result = await submitToWayback("https://example.com/failing", {
        waybackBaseUrl,
        maxRetries: 1,
        sleepFn: async () => {},
      });

      assert.equal(result.status, "ok");
      assert.equal(result.service, "archive.today");
      assert.equal(result.archiveUrl, "https://archive.today/newest/https://example.com/failing");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("calculates archive coverage accurately across registries", () => {
    const mockRules1: RegistryV2Rule[] = [
      {
        id: "npm.test.one",
        ecosystem: "npm",
        purl: "pkg:npm/test-one",
        vers: "vers:npm/<1.0.0",
        event: "deprecated",
        title: "Test One",
        summary: "Deprecated",
        severity: "medium",
        sources: [
          {
            title: "Source 1",
            url: "https://example.com/s1",
            accessedAt: "2026-11-01",
            archiveUrl: "https://web.archive.org/web/20261101/https://example.com/s1",
          },
        ],
        provenance: {
          observedAt: "2026-11-01",
          reviewedAt: "2026-11-01",
          reviewer: "arminazimi",
          method: "manual",
        },
      },
      {
        id: "npm.test.two",
        ecosystem: "npm",
        purl: "pkg:npm/test-two",
        vers: "vers:npm/<2.0.0",
        event: "deprecated",
        title: "Test Two",
        summary: "Deprecated",
        severity: "low",
        sources: [
          {
            title: "Source 2",
            url: "https://example.com/s2",
            accessedAt: "2026-11-01",
          },
        ],
        provenance: {
          observedAt: "2026-11-01",
          reviewedAt: "2026-11-01",
          reviewer: "arminazimi",
          method: "manual",
        },
      },
    ];

    const coverage = calculateArchiveCoverage([{ name: "npm", rules: mockRules1 }]);
    assert.equal(coverage.totalSources, 2);
    assert.equal(coverage.archivedSources, 1);
    assert.equal(coverage.coveragePercentage, 50);
    assert.equal(coverage.targetMet, false);
    assert.deepEqual(coverage.unarchived, ["https://example.com/s2"]);

    // If lock provides the archiveUrl for s2
    const coverageWithLock = calculateArchiveCoverage([{ name: "npm", rules: mockRules1 }], {
      "https://example.com/s2": { archiveUrl: "https://web.archive.org/web/s2" },
    });
    assert.equal(coverageWithLock.archivedSources, 2);
    assert.equal(coverageWithLock.coveragePercentage, 100);
    assert.equal(coverageWithLock.targetMet, true);

    const md = formatArchiveCoverageMarkdown(coverageWithLock);
    assert.ok(md.includes("Evidence Source Archive Coverage Report"));
    assert.ok(md.includes("Target met"));
  });

  it("sourcesOf exposes archiveUrl and archivedAt for registered rules", () => {
    const res = sourcesOf("npm.package.request.deprecated");
    assert.ok(res.sources.length > 0);
    const firstSource = res.sources[0]!;
    assert.ok(firstSource.archiveUrl, "Expected archiveUrl in sourcesOf output");
    assert.ok(
      firstSource.archiveUrl?.startsWith("https://web.archive.org/") ||
        firstSource.archiveUrl?.startsWith("https://archive.today/"),
    );
  });
});
