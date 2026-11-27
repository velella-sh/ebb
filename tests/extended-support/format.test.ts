import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCheckText, formatCheckAllText } from "../../src/cli/format/text.js";
import { formatCheckResult } from "../../src/mcp/format.js";
import type { CheckResult } from "../../src/check.js";

describe("extended support formatting", () => {
  const dummyResult: CheckResult = {
    schemaVersion: 1,
    status: "unsupported",
    version: "2.7.18",
    extendedSupportUntil: "2029-06-30",
    matches: [
      {
        ruleId: "java.maven.spring-boot.legacy-2x.end-of-support",
        event: "unsupported",
        date: null,
        daysLeft: null,
        replacement: "Spring Boot 4.1.x",
        sources: [
          {
            title: "Spring Boot support policy",
            url: "https://spring.io/projects/spring-boot#support",
            accessedAt: "2026-10-25",
          },
        ],
        reviewedAt: "2026-10-25",
        confidence: "confirmed",
      },
      {
        ruleId: "java.maven.spring-boot.extended-support-2.7",
        event: "scheduled",
        date: "2029-06-30",
        daysLeft: 946,
        replacement: "Spring Boot 4.1.x",
        sources: [
          {
            title: "Spring Boot support policy",
            url: "https://spring.io/projects/spring-boot#support",
            accessedAt: "2026-11-27",
          },
        ],
        reviewedAt: "2026-11-27",
        confidence: "confirmed",
      },
    ],
  };

  it("formatCheckText includes extended support date and source", () => {
    const formatted = formatCheckText("pkg:maven/org.springframework.boot/spring-boot", "2.7.18", dummyResult);
    assert.match(formatted, /Extended support until 2029-06-30 \(Spring Boot support policy\)/);
  });

  it("formatCheckAllText includes extended support date and source", () => {
    const outcome = {
      schemaVersion: 1 as const,
      results: [dummyResult],
      summary: {
        total: 1,
        byStatus: {
          ok: 0,
          deprecated: 0,
          unsupported: 1,
          "end-of-life": 0,
          removed: 0,
          scheduled: 0,
        },
        byEvent: {
          deprecated: 0,
          unsupported: 1,
          "end-of-life": 0,
          removed: 0,
          scheduled: 0,
        },
        errors: 0,
      },
    };
    const items = [
      {
        purl: "pkg:maven/org.springframework.boot/spring-boot",
        version: "2.7.18",
      },
    ];
    const formatted = formatCheckAllText(items, outcome);
    assert.match(formatted, /Extended support until 2029-06-30 \(Spring Boot support policy\)/);
  });

  it("formatCheckResult preserves extendedSupportUntil for MCP", () => {
    const formatted = formatCheckResult(dummyResult);
    assert.equal(formatted.extendedSupportUntil, "2029-06-30");
  });
});
