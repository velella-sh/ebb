import assert from "node:assert/strict";
import { test } from "node:test";
import { check, orderMatches, type CheckMatch } from "../../src/check.js";
import type { EvidenceSource } from "../../src/domain.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

const source: EvidenceSource = {
  title: "test",
  url: "https://example.com",
};

function match(partial: Pick<CheckMatch, "ruleId" | "event" | "date">): CheckMatch {
  return { ...partial, daysLeft: null, replacement: null, sources: [source], reviewedAt: "2026-04-01" };
}

test("three mixed matches sort by event seriousness, then earliest date", () => {
  // Deliberately out of order: scheduled (least serious), then removed, then
  // two end-of-life rows with the later date first, then an undated deprecated.
  const ordered = orderMatches([
    match({ ruleId: "scheduled-late", event: "scheduled", date: "2030-01-01" }),
    match({ ruleId: "eol-later", event: "end-of-life", date: "2026-06-01" }),
    match({ ruleId: "removed", event: "removed", date: "2024-01-01" }),
    match({ ruleId: "eol-earlier", event: "end-of-life", date: "2025-01-01" }),
    match({ ruleId: "deprecated-undated", event: "deprecated", date: null }),
  ]);

  assert.deepEqual(
    ordered.map((item) => item.ruleId),
    ["eol-earlier", "eol-later", "removed", "deprecated-undated", "scheduled-late"],
  );
});

test("undated rules sort after dated ones at the same event", () => {
  const ordered = orderMatches([
    match({ ruleId: "undated", event: "deprecated", date: null }),
    match({ ruleId: "dated", event: "deprecated", date: "2020-02-11" }),
  ]);
  assert.deepEqual(
    ordered.map((item) => item.ruleId),
    ["dated", "undated"],
  );
});

test("equal event and date keep the original order (stable)", () => {
  const ordered = orderMatches([
    match({ ruleId: "first", event: "unsupported", date: "2025-01-01" }),
    match({ ruleId: "second", event: "unsupported", date: "2025-01-01" }),
    match({ ruleId: "third", event: "unsupported", date: "2025-01-01" }),
  ]);
  assert.deepEqual(
    ordered.map((item) => item.ruleId),
    ["first", "second", "third"],
  );
});

test("check puts the more serious overlapping rule first", () => {
  // pycrypto: end-of-life (dated) and deprecated (undated) both cover every version.
  const result = check("pkg:pypi/pycrypto", "2.6.1", AS_OF);
  assert.ok(result.matches.length >= 2);
  assert.equal(result.matches[0]?.event, "end-of-life");
  assert.equal(result.status, "end-of-life");
  assert.equal(result.matches[0]?.ruleId, "python.package.pycrypto.obsolete");
});

test("check puts the earlier deadline before an undated peer", () => {
  // request: dated deprecated before the undated OSV twin.
  const result = check("pkg:npm/request", "2.88.0", AS_OF);
  assert.ok(result.matches.length >= 2);
  assert.equal(result.matches[0]?.ruleId, "npm.package.request.deprecated");
  assert.equal(result.matches[0]?.date, "2020-02-11");
  assert.equal(result.matches[1]?.ruleId, "osv.npm.request");
  assert.equal(result.matches[1]?.date, null);
});
