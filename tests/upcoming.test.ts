import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWithinWindow, upcoming, UpcomingError } from "../src/upcoming.js";
import { runCli } from "../src/cli.js";
import type { RegistryV2Rule } from "../src/registry.js";

function createMockRule(partial: Partial<RegistryV2Rule> & { id: string; deadline: string }): RegistryV2Rule {
  return {
    id: partial.id,
    ecosystem: partial.ecosystem ?? "npm",
    purl: partial.purl ?? `pkg:npm/${partial.id}`,
    vers: partial.vers ?? "vers:npm/*",
    event: partial.event ?? "scheduled-end-of-life",
    title: partial.title ?? `Lifecycle event for ${partial.id}`,
    summary: partial.summary ?? `Summary for ${partial.id}`,
    severity: partial.severity ?? "high",
    deadline: partial.deadline,
    sources: partial.sources ?? [{ title: "Source", url: "https://example.com" }],
    provenance: partial.provenance ?? {
      observedAt: "2026-01-01",
      reviewedAt: "2026-01-01",
      reviewer: "test",
    },
    ...(partial.replacement ? { replacement: partial.replacement } : {}),
    ...(partial["x-estimated"] ? { "x-estimated": partial["x-estimated"] } : {}),
  };
}

describe("upcoming: parseWithinWindow", () => {
  const asOf = "2026-11-11";

  it("defaults to 90d when within is omitted or empty", () => {
    const res1 = parseWithinWindow(undefined, asOf);
    assert.equal(res1.span, "90d");
    assert.equal(res1.days, 90);
    assert.equal(res1.until, "2027-02-09");

    const res2 = parseWithinWindow("", asOf);
    assert.equal(res2.span, "90d");
  });

  it("parses day units (d)", () => {
    const res = parseWithinWindow("30d", asOf);
    assert.equal(res.span, "30d");
    assert.equal(res.days, 30);
    assert.equal(res.until, "2026-12-11");
  });

  it("parses week units (w)", () => {
    const res = parseWithinWindow("2w", asOf);
    assert.equal(res.span, "2w");
    assert.equal(res.days, 14);
    assert.equal(res.until, "2026-11-25");
  });

  it("parses month units (m)", () => {
    const res = parseWithinWindow("3m", asOf);
    assert.equal(res.span, "3m");
    assert.equal(res.until, "2027-02-11");
    assert.ok(res.days >= 89 && res.days <= 92);
  });

  it("parses year units (y)", () => {
    const res = parseWithinWindow("1y", asOf);
    assert.equal(res.span, "1y");
    assert.equal(res.until, "2027-11-11");
    assert.ok(res.days >= 365 && res.days <= 366);
  });

  it("accepts bare numbers as days", () => {
    const resNum = parseWithinWindow(45, asOf);
    assert.equal(resNum.span, "45d");
    assert.equal(resNum.days, 45);
    assert.equal(resNum.until, "2026-12-26");

    const resStr = parseWithinWindow("45", asOf);
    assert.equal(resStr.span, "45d");
    assert.equal(resStr.days, 45);
  });

  it("throws UpcomingError for invalid within formats", () => {
    assert.throws(() => parseWithinWindow("invalid", asOf), UpcomingError);
    assert.throws(() => parseWithinWindow("-5d", asOf), UpcomingError);
    assert.throws(() => parseWithinWindow("10x", asOf), UpcomingError);
    assert.throws(() => parseWithinWindow(-10, asOf), UpcomingError);
  });
});

describe("upcoming: core filtering, calculation and sorting", () => {
  const asOf = "2026-11-11";

  const mockRules: RegistryV2Rule[] = [
    createMockRule({
      id: "rule-past",
      deadline: "2026-10-01",
      severity: "critical",
      ecosystem: "npm",
    }),
    createMockRule({
      id: "rule-far-future",
      deadline: "2028-01-01",
      severity: "low",
      ecosystem: "npm",
    }),
    createMockRule({
      id: "rule-soon-high",
      deadline: "2026-11-20",
      severity: "high",
      ecosystem: "npm",
      purl: "pkg:npm/my-lib",
      vers: "vers:npm/>=1.0.0|<2.0.0",
      replacement: "pkg:npm/new-lib@2.0.0",
    }),
    createMockRule({
      id: "rule-soon-critical",
      deadline: "2026-11-20",
      severity: "critical",
      ecosystem: "npm",
      purl: "pkg:npm/crit-lib",
    }),
    createMockRule({
      id: "rule-later-python",
      deadline: "2026-12-15",
      severity: "medium",
      ecosystem: "python",
      purl: "pkg:pypi/my-py-pkg",
      "x-estimated": { estimated: true },
    }),
    createMockRule({
      id: "rule-today",
      deadline: "2026-11-11",
      severity: "info",
      ecosystem: "nodejs",
      purl: "pkg:generic/node",
    }),
  ];

  it("excludes expired events and events past the window", () => {
    const res = upcoming({
      asOf,
      within: "60d",
      rules: mockRules,
    });

    assert.equal(res.asOf, asOf);
    assert.equal(res.within, "60d");
    assert.equal(res.count, 4);

    const ids = res.items.map((i) => i.ruleId);
    assert.ok(!ids.includes("rule-past"));
    assert.ok(!ids.includes("rule-far-future"));
    assert.ok(ids.includes("rule-today"));
    assert.ok(ids.includes("rule-soon-high"));
    assert.ok(ids.includes("rule-soon-critical"));
    assert.ok(ids.includes("rule-later-python"));
  });

  it("calculates accurate daysLeft", () => {
    const res = upcoming({
      asOf,
      within: "60d",
      rules: mockRules,
    });

    const todayEvent = res.items.find((i) => i.ruleId === "rule-today");
    assert.ok(todayEvent);
    assert.equal(todayEvent.daysLeft, 0);

    const soonEvent = res.items.find((i) => i.ruleId === "rule-soon-high");
    assert.ok(soonEvent);
    assert.equal(soonEvent.daysLeft, 9); // Nov 20 - Nov 11 = 9 days
  });

  it("sorts by date ascending, then severity descending", () => {
    const res = upcoming({
      asOf,
      within: "60d",
      rules: mockRules,
    });

    // Order should be:
    // 1. rule-today (2026-11-11)
    // 2. rule-soon-critical (2026-11-20, critical)
    // 3. rule-soon-high (2026-11-20, high)
    // 4. rule-later-python (2026-12-15)
    assert.equal(res.items[0]?.ruleId, "rule-today");
    assert.equal(res.items[1]?.ruleId, "rule-soon-critical");
    assert.equal(res.items[2]?.ruleId, "rule-soon-high");
    assert.equal(res.items[3]?.ruleId, "rule-later-python");
  });

  it("marks estimated dates accurately", () => {
    const res = upcoming({
      asOf,
      within: "60d",
      rules: mockRules,
    });

    const estimatedItem = res.items.find((i) => i.ruleId === "rule-later-python");
    assert.ok(estimatedItem);
    assert.equal(estimatedItem.estimated, true);

    const regularItem = res.items.find((i) => i.ruleId === "rule-soon-high");
    assert.ok(regularItem);
    assert.equal(regularItem.estimated, false);
  });

  it("filters by ecosystem", () => {
    const res = upcoming({
      asOf,
      within: "60d",
      ecosystem: "python",
      rules: mockRules,
    });

    assert.equal(res.count, 1);
    assert.equal(res.items[0]?.ruleId, "rule-later-python");
  });

  it("filters by ecosystem array case-insensitively", () => {
    const res = upcoming({
      asOf,
      within: "60d",
      ecosystem: ["PYTHON", "NODEJS"],
      rules: mockRules,
    });

    assert.equal(res.count, 2);
    const ids = res.items.map((i) => i.ruleId);
    assert.ok(ids.includes("rule-today"));
    assert.ok(ids.includes("rule-later-python"));
  });

  it("filters by PURL with and without version", () => {
    // Target matches pkg:npm/my-lib version 1.5.0
    const resMatching = upcoming({
      asOf,
      within: "60d",
      purls: ["pkg:npm/my-lib@1.5.0"],
      rules: mockRules,
    });
    assert.equal(resMatching.count, 1);
    assert.equal(resMatching.items[0]?.ruleId, "rule-soon-high");

    // Target does not match version 2.5.0
    const resNonMatching = upcoming({
      asOf,
      within: "60d",
      purls: ["pkg:npm/my-lib@2.5.0"],
      rules: mockRules,
    });
    assert.equal(resNonMatching.count, 0);

    // Bare target matches all rules for that package
    const resBare = upcoming({
      asOf,
      within: "60d",
      purls: ["pkg:npm/my-lib"],
      rules: mockRules,
    });
    assert.equal(resBare.count, 1);
    assert.equal(resBare.items[0]?.ruleId, "rule-soon-high");
  });
});

describe("upcoming: real bundled registry data with fixed clock", () => {
  it("queries real registry with fixed asOf and finds upcoming events", () => {
    // Use an asOf date that has known scheduled events in the registry
    const res = upcoming({
      asOf: "2026-01-01",
      within: "1y",
      ecosystem: "nodejs",
    });

    assert.ok(res.count > 0, "Should have upcoming nodejs events within 1y of 2026-01-01");
    for (const item of res.items) {
      assert.equal(item.ecosystem, "nodejs");
      assert.ok(item.deadline >= "2026-01-01");
      assert.ok(item.deadline <= res.until);
      assert.ok(item.daysLeft >= 0);
    }
  });
});

describe("upcoming: CLI command", () => {
  it("runs ebb upcoming with --as-of and returns text output", async () => {
    let stdout = "";
    let stderr = "";
    const code = await runCli(["upcoming", "--as-of", "2026-01-01", "--within", "180d"], {
      stdout: {
        write: (str: string) => {
          stdout += str;
        },
      },
      stderr: {
        write: (str: string) => {
          stderr += str;
        },
      },
    });

    assert.equal(code, 0);
    assert.equal(stderr, "");
    assert.ok(stdout.includes("Upcoming deadlines within 180d (as of 2026-01-01"));
  });

  it("runs ebb upcoming --json and returns valid JSON matching schema", async () => {
    let stdout = "";
    let stderr = "";
    const code = await runCli(["upcoming", "--as-of", "2026-01-01", "--within", "90d", "--json"], {
      stdout: {
        write: (str: string) => {
          stdout += str;
        },
      },
      stderr: {
        write: (str: string) => {
          stderr += str;
        },
      },
    });

    assert.equal(code, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.asOf, "2026-01-01");
    assert.equal(parsed.within, "90d");
    assert.ok(typeof parsed.count === "number");
    assert.ok(Array.isArray(parsed.items));
  });

  it("runs ebb upcoming --format markdown", async () => {
    let stdout = "";
    let stderr = "";
    const code = await runCli(["upcoming", "--as-of", "2026-01-01", "--within", "90d", "--format", "markdown"], {
      stdout: {
        write: (str: string) => {
          stdout += str;
        },
      },
      stderr: {
        write: (str: string) => {
          stderr += str;
        },
      },
    });

    assert.equal(code, 0);
    assert.ok(stdout.includes("### Upcoming Lifecycle Deadlines"));
    assert.ok(stdout.includes("| Deadline | Days Left | Severity | PURL | Event | Replacement |"));
  });

  it("handles invalid within argument gracefully with code 2", async () => {
    let stderr = "";
    const code = await runCli(["upcoming", "--within", "invalid-time"], {
      stdout: { write: () => {} },
      stderr: {
        write: (str: string) => {
          stderr += str;
        },
      },
    });

    assert.equal(code, 2);
    assert.ok(stderr.includes("Error: Invalid within window"));
  });
});
