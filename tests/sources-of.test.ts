import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asOf, sourcesOf, type SourceEntry } from "../src/index.js";
import { EbbError } from "../src/errors.js";
import { runCli } from "../src/cli.js";
import type { RegistryV2Rule } from "../src/registry.js";

describe("sourcesOf", () => {
  it("looks up a bundled rule by ID and returns complete evidence sources", () => {
    const result = sourcesOf("npm.package.request.deprecated");

    assert.equal(result.ruleId, "npm.package.request.deprecated");
    assert.equal(result.ecosystem, "npm");
    assert.equal(result.purl, "pkg:npm/request");
    assert.equal(result.event, "deprecated");
    assert.equal(result.reviewer, "arminazimi");
    assert.ok(result.reviewedAt);
    assert.ok(result.observedAt);
    assert.ok(Array.isArray(result.sources));
    assert.ok(result.sources.length >= 1);

    const firstSource = result.sources[0]!;
    assert.ok(firstSource.title);
    assert.ok(firstSource.url.startsWith("https://"));
    assert.ok(firstSource.health === "ok" || firstSource.health === "unrecorded");
    assert.equal(firstSource.status, firstSource.health);
  });

  it("handles rules with many sources (e.g. Next.js 12 with 5 sources)", () => {
    const result = sourcesOf("npm.package.next.12.support-end");

    assert.equal(result.ruleId, "npm.package.next.12.support-end");
    assert.equal(result.sources.length, 5);

    // Verify every source has title, url, and health
    for (const source of result.sources) {
      assert.ok(source.title.length > 0);
      assert.ok(source.url.startsWith("https://nextjs.org/"));
      assert.equal(source.health, "ok");
    }
  });

  it("handles a rule with 10+ sources via options.rules", () => {
    const mockSources = Array.from({ length: 12 }, (_, i) => ({
      title: `Source Documentation Page ${i + 1}`,
      url: `https://example.com/docs/v${i + 1}`,
      accessedAt: "2026-11-01",
    }));

    const mockRule: RegistryV2Rule = {
      id: "custom.many-sources.rule",
      ecosystem: "custom",
      purl: "pkg:npm/custom-package",
      vers: "vers:npm/>=1.0.0|<2.0.0",
      event: "deprecated",
      title: "Custom rule with extensive sources",
      summary: "Detailed summary",
      severity: "medium",
      sources: mockSources,
      provenance: {
        observedAt: "2026-11-01",
        reviewedAt: "2026-11-05",
        reviewer: "reviewer-1",
        method: "manual",
      },
    };

    const result = sourcesOf("custom.many-sources.rule", { rules: [mockRule] });
    assert.equal(result.sources.length, 12);
    assert.equal(result.sources[0]?.title, "Source Documentation Page 1");
    assert.equal(result.sources[11]?.title, "Source Documentation Page 12");
  });

  it("includes archive URL when explicitly provided or from an archive host", () => {
    const mockRule: RegistryV2Rule = {
      id: "archive.test.rule",
      ecosystem: "test",
      purl: "pkg:npm/test-archive",
      vers: "vers:npm/>=1.0.0",
      event: "end-of-life",
      title: "Archive test rule",
      summary: "Summary",
      severity: "high",
      sources: [
        {
          title: "Wayback snapshot",
          url: "https://web.archive.org/web/20250101000000/https://example.com/eol",
        },
        {
          title: "Explicit archive property",
          url: "https://example.com/original-page",
          archiveUrl: "https://web.archive.org/web/20260101000000/https://example.com/original-page",
        } as unknown as { title: string; url: string },
        {
          title: "Live page without archive",
          url: "https://example.com/live",
        },
      ],
      provenance: {
        observedAt: "2026-01-01",
        reviewedAt: "2026-01-02",
        reviewer: "archivist",
        method: "manual",
      },
    };

    const result = sourcesOf("archive.test.rule", { rules: [mockRule] });
    assert.equal(result.sources[0]?.archiveUrl, "https://web.archive.org/web/20250101000000/https://example.com/eol");
    assert.equal(
      result.sources[1]?.archiveUrl,
      "https://web.archive.org/web/20260101000000/https://example.com/original-page",
    );
    assert.equal(result.sources[2]?.archiveUrl, undefined);
  });

  it("reports source health status correctly (ok, unrecorded, custom)", () => {
    const mockRule: RegistryV2Rule = {
      id: "health.test.rule",
      ecosystem: "test",
      purl: "pkg:npm/health-test",
      vers: "vers:npm/>=1.0.0",
      event: "deprecated",
      title: "Health test rule",
      summary: "Testing health statuses",
      severity: "medium",
      sources: [
        // Known locked source in sources.lock.json
        {
          title: "Red Hat Lifecycle",
          url: "https://access.redhat.com/product-life-cycles",
        },
        // Unrecorded synthetic URL
        {
          title: "Unrecorded page",
          url: "https://example.org/nonexistent-unrecorded-page-9999",
        },
        // Explicit health status override
        {
          title: "Explicit unreachable",
          url: "https://example.com/dead",
          health: "unreachable",
        } as unknown as { title: string; url: string },
      ],
      provenance: {
        observedAt: "2026-11-01",
        reviewedAt: "2026-11-01",
        reviewer: "health-checker",
        method: "manual",
      },
    };

    const result = sourcesOf("health.test.rule", { rules: [mockRule] });
    assert.equal(result.sources[0]?.health, "ok");
    assert.equal(result.sources[1]?.health, "unrecorded");
    assert.equal(result.sources[2]?.health, "unreachable");
  });

  it("returns clear error for unknown rule ids", () => {
    assert.throws(
      () => sourcesOf("nonexistent.unknown.rule.id"),
      (err: unknown) => {
        const ebbErr = err as EbbError;
        assert(ebbErr instanceof EbbError);
        assert.equal(ebbErr.code, "rule-not-found");
        assert.ok(ebbErr.message.includes("nonexistent.unknown.rule.id"));
        return true;
      },
    );

    assert.throws(
      () => sourcesOf(""),
      (err: unknown) => {
        const ebbErr = err as EbbError;
        assert(ebbErr instanceof EbbError);
        assert.equal(ebbErr.code, "rule-not-found");
        return true;
      },
    );
  });

  it("filters rules relative to asOf date", () => {
    // Succeeds when asOf is on or after observedAt (npm.package.request.deprecated observed in 2026)
    const asOfAfter = sourcesOf("npm.package.request.deprecated", { asOf: "2027-01-01" });
    assert.equal(asOfAfter.ruleId, "npm.package.request.deprecated");

    // Throws rule-not-found when asOf is before observedAt
    assert.throws(
      () => sourcesOf("npm.package.request.deprecated", { asOf: "2020-01-01" }),
      (err: unknown) => {
        const ebbErr = err as EbbError;
        assert(ebbErr instanceof EbbError);
        assert.equal(ebbErr.code, "rule-not-found");
        assert.ok(ebbErr.message.includes("not found as of 2020-01-01"));
        return true;
      },
    );

    // Throws invalid-date on bad asOf format
    assert.throws(
      () => sourcesOf("npm.package.request.deprecated", { asOf: "invalid-date" }),
      (err: unknown) => {
        const ebbErr = err as EbbError;
        assert(ebbErr instanceof EbbError);
        assert.equal(ebbErr.code, "invalid-date");
        return true;
      },
    );
  });

  it("integrates with asOf(date) scoped client", () => {
    const client = asOf("2027-01-01");
    const result = client.sourcesOf("npm.package.request.deprecated");
    assert.equal(result.ruleId, "npm.package.request.deprecated");
    assert.equal(result.event, "deprecated");

    const pastClient = asOf("2020-01-01");
    assert.throws(
      () => pastClient.sourcesOf("npm.package.request.deprecated"),
      (err: unknown) => {
        const ebbErr = err as EbbError;
        assert(ebbErr instanceof EbbError);
        assert.equal(ebbErr.code, "rule-not-found");
        return true;
      },
    );
  });

  describe("CLI ebb sources", () => {
    function createMockIo() {
      let stdout = "";
      let stderr = "";
      return {
        stdout: {
          write: (text: string) => {
            stdout += text;
            return true;
          },
        },
        stderr: {
          write: (text: string) => {
            stderr += text;
            return true;
          },
        },
        getStdout: () => stdout,
        getStderr: () => stderr,
      };
    }

    it("outputs human-readable text by default", async () => {
      const io = createMockIo();
      const code = await runCli(["sources", "npm.package.request.deprecated", "--no-color"], io as any);
      assert.equal(code, 0);
      const out = io.getStdout();
      assert.ok(out.includes("Rule: npm.package.request.deprecated"));
      assert.ok(out.includes("Ecosystem: npm"));
      assert.ok(out.includes("Reviewer: arminazimi"));
      assert.ok(out.includes("Sources ("));
      assert.ok(out.includes("https://"));
    });

    it("outputs markdown when --format markdown is passed", async () => {
      const io = createMockIo();
      const code = await runCli(["sources", "npm.package.request.deprecated", "--format", "markdown"], io as any);
      assert.equal(code, 0);
      const out = io.getStdout();
      assert.ok(out.includes("# Sources for `npm.package.request.deprecated`"));
      assert.ok(out.includes("- **Ecosystem:** npm"));
      assert.ok(out.includes("## Evidence Sources"));
    });

    it("outputs json when --json is passed", async () => {
      const io = createMockIo();
      const code = await runCli(["sources", "npm.package.request.deprecated", "--json"], io as any);
      assert.equal(code, 0);
      const parsed = JSON.parse(io.getStdout()) as { ruleId: string; sources: SourceEntry[] };
      assert.equal(parsed.ruleId, "npm.package.request.deprecated");
      assert.ok(Array.isArray(parsed.sources));
      assert.ok(parsed.sources.length > 0);
    });

    it("supports --as-of flag in CLI", async () => {
      const io = createMockIo();
      const code = await runCli(["sources", "npm.package.request.deprecated", "--as-of", "2020-01-01"], io as any);
      assert.equal(code, 2);
      assert.ok(io.getStderr().includes("not found as of 2020-01-01"));
    });

    it("exits with 2 on missing rule id", async () => {
      const io = createMockIo();
      const code = await runCli(["sources"], io as any);
      assert.equal(code, 2);
      assert.ok(io.getStderr().includes("Usage: ebb sources <rule-id>"));
    });

    it("exits with 2 on unknown rule id", async () => {
      const io = createMockIo();
      const code = await runCli(["sources", "totally-unknown-id"], io as any);
      assert.equal(code, 2);
      assert.ok(io.getStderr().includes('Rule "totally-unknown-id" not found'));
    });
  });
});
