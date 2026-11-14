import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RegistryV2, RegistryV2Rule } from "../src/registry.js";
import { DEFAULT_MAX_REVIEW_AGE_DAYS } from "../src/registry.js";
import {
  DEFAULT_STALE_SOON_DAYS,
  STALE_ISSUE_MARKER,
  STALE_SCHEMA_VERSION,
  formatStaleIssueBody,
  formatStaleIssueTitle,
  formatStaleText,
  parseDaySpan,
  stale,
  staleOn,
} from "../src/stale.js";

const AS_OF = "2026-11-14";

function makeRule(overrides: { id: string; reviewedAt: string; ecosystem?: string; title?: string }): RegistryV2Rule {
  const ecosystem = overrides.ecosystem ?? "npm";
  const name = overrides.id.split(".").pop() ?? "x";
  return {
    id: overrides.id,
    ecosystem,
    purl: `pkg:npm/${name}`,
    vers: "vers:npm/*",
    event: "deprecated",
    title: overrides.title ?? `Rule ${overrides.id}`,
    summary: "Summary",
    severity: "high",
    sources: [{ title: "Source", url: "https://example.com/src" }],
    provenance: {
      observedAt: overrides.reviewedAt,
      reviewedAt: overrides.reviewedAt,
      reviewer: "maintainer",
      method: "manual",
    },
  };
}

function registry(ecosystem: string, rules: RegistryV2Rule[], maxReviewAgeDays?: number): RegistryV2 {
  return {
    schemaVersion: "ebb.registry.v2",
    ecosystem,
    ...(maxReviewAgeDays === undefined ? {} : { freshness: { maxReviewAgeDays } }),
    rules,
  };
}

describe("parseDaySpan", () => {
  it("accepts integers and day/week/month/year strings", () => {
    assert.deepEqual(parseDaySpan(90, "olderThan"), { days: 90, span: "90d" });
    assert.deepEqual(parseDaySpan("90", "olderThan"), { days: 90, span: "90d" });
    assert.deepEqual(parseDaySpan("90d", "olderThan"), { days: 90, span: "90d" });
    assert.deepEqual(parseDaySpan("2w", "olderThan"), { days: 14, span: "2w" });
    assert.equal(parseDaySpan("3m", "olderThan", "2026-01-01").days, 90);
    assert.equal(parseDaySpan("1y", "olderThan", "2026-01-01").days, 365);
  });

  it("rejects invalid durations", () => {
    assert.throws(() => parseDaySpan(-1, "olderThan"), /Invalid olderThan/);
    assert.throws(() => parseDaySpan(1.5, "olderThan"), /Invalid olderThan/);
    assert.throws(() => parseDaySpan("90x", "olderThan"), /Invalid olderThan/);
    assert.throws(() => parseDaySpan("", "olderThan"), /Invalid olderThan/);
  });
});

describe("stale", () => {
  it("reports nothing when every rule is fresh", () => {
    const result = stale({
      asOf: AS_OF,
      rules: [makeRule({ id: "npm.package.fresh.deprecated", reviewedAt: "2026-10-01" })],
      maxReviewAgeDays: 365,
    });
    assert.equal(result.schemaVersion, STALE_SCHEMA_VERSION);
    assert.equal(result.asOf, AS_OF);
    assert.equal(result.soonWithin, "30d");
    assert.deepEqual(result.stale, []);
    assert.deepEqual(result.staleSoon, []);
    assert.deepEqual(result.counts, { stale: 0, staleSoon: 0, fresh: 1, total: 1 });
  });

  it("flags rules older than the default 365-day window", () => {
    const result = stale({
      asOf: AS_OF,
      rules: [
        makeRule({ id: "npm.package.old.deprecated", reviewedAt: "2025-01-01" }),
        makeRule({ id: "npm.package.new.deprecated", reviewedAt: "2026-10-01" }),
      ],
    });
    assert.equal(result.counts.stale, 1);
    assert.equal(result.stale[0]!.ruleId, "npm.package.old.deprecated");
    assert.equal(result.stale[0]!.maxReviewAgeDays, DEFAULT_MAX_REVIEW_AGE_DAYS);
    assert.ok(result.stale[0]!.ageDays > DEFAULT_MAX_REVIEW_AGE_DAYS);
    assert.ok(result.stale[0]!.daysUntilStale <= 0);
  });

  it("uses olderThan to override the review window", () => {
    const result = stale({
      asOf: AS_OF,
      olderThan: 30,
      rules: [
        makeRule({ id: "npm.package.old.deprecated", reviewedAt: "2026-09-01" }),
        makeRule({ id: "npm.package.fresh.deprecated", reviewedAt: "2026-11-01" }),
      ],
    });
    assert.deepEqual(
      result.stale.map((entry) => entry.ruleId),
      ["npm.package.old.deprecated"],
    );
    assert.equal(result.stale[0]!.maxReviewAgeDays, 30);
    assert.equal(result.olderThan, "30d");
  });

  it("accepts olderThan as a duration string", () => {
    const result = stale({
      asOf: AS_OF,
      olderThan: "30d",
      rules: [makeRule({ id: "npm.package.old.deprecated", reviewedAt: "2026-09-01" })],
    });
    assert.equal(result.counts.stale, 1);
    assert.equal(result.stale[0]!.maxReviewAgeDays, 30);
  });

  it("uses each registry's maxReviewAgeDays", () => {
    const result = stale({
      asOf: AS_OF,
      registries: [
        registry(
          "rust",
          [makeRule({ id: "rust.crate.old.deprecated", ecosystem: "rust", reviewedAt: "2026-09-01" })],
          45,
        ),
        registry("npm", [makeRule({ id: "npm.package.ok.deprecated", reviewedAt: "2026-09-01" })], 365),
      ],
    });
    assert.deepEqual(
      result.stale.map((entry) => [entry.ruleId, entry.maxReviewAgeDays]),
      [["rust.crate.old.deprecated", 45]],
    );
    assert.equal(result.counts.fresh, 1);
  });

  it("lists rules that turn stale within the next 30 days", () => {
    // age === 100, max === 100 → still fresh, stale tomorrow (1 day left)
    const almost = makeRule({ id: "npm.package.almost.deprecated", reviewedAt: "2026-08-06" });
    // age === 121 → already stale
    const overdue = makeRule({ id: "npm.package.overdue.deprecated", reviewedAt: "2026-07-16" });
    // age === 44 → well inside the window
    const fresh = makeRule({ id: "npm.package.fresh.deprecated", reviewedAt: "2026-10-01" });

    const result = stale({
      asOf: AS_OF,
      maxReviewAgeDays: 100,
      rules: [almost, overdue, fresh],
    });

    assert.deepEqual(
      result.stale.map((entry) => entry.ruleId),
      ["npm.package.overdue.deprecated"],
    );
    assert.deepEqual(
      result.staleSoon.map((entry) => entry.ruleId),
      ["npm.package.almost.deprecated"],
    );
    assert.equal(result.staleSoon[0]!.daysUntilStale, 1);
    assert.equal(staleOn(almost.provenance.reviewedAt, 100), "2026-11-15");
    assert.equal(result.counts.fresh, 1);
    assert.equal(DEFAULT_STALE_SOON_DAYS, 30);
  });

  it("respects a custom soonWithin window", () => {
    // age === 90, max === 100 → daysUntilStale === 11
    const rule = makeRule({ id: "npm.package.mid.deprecated", reviewedAt: "2026-08-16" });
    const within30 = stale({ asOf: AS_OF, maxReviewAgeDays: 100, soonWithin: 30, rules: [rule] });
    const within7 = stale({ asOf: AS_OF, maxReviewAgeDays: 100, soonWithin: "7d", rules: [rule] });
    assert.equal(within30.counts.staleSoon, 1);
    assert.equal(within7.counts.staleSoon, 0);
    assert.equal(within7.counts.fresh, 1);
  });

  it("matches the registry staleRules boundary (age === max is still fresh)", () => {
    const onBoundary = makeRule({ id: "npm.package.boundary.deprecated", reviewedAt: "2026-08-16" });
    const result = stale({
      asOf: "2026-11-14",
      maxReviewAgeDays: 90,
      rules: [onBoundary],
    });
    assert.equal(result.counts.stale, 0);
    assert.equal(result.counts.staleSoon, 1);
    assert.equal(result.staleSoon[0]!.ageDays, 90);
    assert.equal(result.staleSoon[0]!.daysUntilStale, 1);

    const nextDay = stale({
      asOf: "2026-11-15",
      maxReviewAgeDays: 90,
      rules: [onBoundary],
    });
    assert.equal(nextDay.counts.stale, 1);
    assert.equal(nextDay.stale[0]!.daysUntilStale, 0);
  });

  it("uses an injected clock when asOf is omitted", () => {
    const result = stale({
      clock: () => new Date("2026-11-14T15:30:00Z"),
      olderThan: 30,
      rules: [makeRule({ id: "npm.package.old.deprecated", reviewedAt: "2026-01-01" })],
    });
    assert.equal(result.asOf, "2026-11-14");
    assert.equal(result.counts.stale, 1);
  });

  it("rejects an invalid asOf", () => {
    assert.throws(
      () =>
        stale({
          asOf: "14-11-2026",
          rules: [makeRule({ id: "npm.package.x.deprecated", reviewedAt: "2026-01-01" })],
        }),
      /not a date/,
    );
  });

  it("sorts stale findings by age descending, then rule id", () => {
    const result = stale({
      asOf: AS_OF,
      maxReviewAgeDays: 30,
      rules: [
        makeRule({ id: "npm.package.b.deprecated", reviewedAt: "2025-01-01" }),
        makeRule({ id: "npm.package.a.deprecated", reviewedAt: "2025-01-01" }),
        makeRule({ id: "npm.package.c.deprecated", reviewedAt: "2026-01-01" }),
      ],
    });
    assert.deepEqual(
      result.stale.map((entry) => entry.ruleId),
      ["npm.package.a.deprecated", "npm.package.b.deprecated", "npm.package.c.deprecated"],
    );
  });

  it("applies a per-ecosystem maxReviewAgeDays map", () => {
    const result = stale({
      asOf: AS_OF,
      rules: [
        makeRule({ id: "rust.crate.x.deprecated", ecosystem: "rust", reviewedAt: "2026-09-01" }),
        makeRule({ id: "npm.package.x.deprecated", ecosystem: "npm", reviewedAt: "2026-09-01" }),
      ],
      maxReviewAgeDays: { rust: 45, npm: 365 },
    });
    assert.deepEqual(
      result.stale.map((entry) => entry.ruleId),
      ["rust.crate.x.deprecated"],
    );
  });

  it("deduplicates rules that appear more than once", () => {
    const rule = makeRule({ id: "npm.package.dup.deprecated", reviewedAt: "2025-01-01" });
    const result = stale({
      asOf: AS_OF,
      maxReviewAgeDays: 30,
      rules: [rule, rule],
    });
    assert.equal(result.counts.total, 1);
    assert.equal(result.counts.stale, 1);
  });
});

describe("formatters", () => {
  it("renders text and issue markdown with the workflow marker", () => {
    const result = stale({
      asOf: AS_OF,
      maxReviewAgeDays: 30,
      rules: [
        makeRule({ id: "npm.package.old.deprecated", reviewedAt: "2026-01-01" }),
        makeRule({ id: "npm.package.soon.deprecated", reviewedAt: "2026-10-20" }),
      ],
    });
    const text = formatStaleText(result);
    assert.match(text, /Already stale/);
    assert.match(text, /npm\.package\.old\.deprecated/);

    const body = formatStaleIssueBody(result);
    assert.ok(body.startsWith(STALE_ISSUE_MARKER));
    assert.match(body, /## Stale/);
    assert.match(body, /good first task/i);

    const title = formatStaleIssueTitle(result);
    assert.match(title, /^Stale lifecycle rules/);
    assert.match(title, new RegExp(AS_OF));
  });

  it("renders a clean empty report and a zero badge", () => {
    const result = stale({
      asOf: AS_OF,
      rules: [makeRule({ id: "npm.package.fresh.deprecated", reviewedAt: "2026-11-01" })],
      maxReviewAgeDays: 365,
    });
    assert.match(formatStaleText(result), /No rules need review/);
    assert.match(formatStaleIssueBody(result), /No rules need review/);
  });
});
