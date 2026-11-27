import test from "node:test";
import assert from "node:assert/strict";
import { formatHealPrBody, type HealReport } from "../../tools/source-heal/index.js";

test("formatHealPrBody formats relocated source PR body with Fixes issue", () => {
  const report: HealReport = {
    schemaVersion: "ebb.source-heal.v1",
    healedAt: "2026-11-27T10:00:00Z",
    oldUrl: "https://example.com/old",
    ruleIds: ["rule.1"],
    failures: [{ timestamp: "2026-11-26T00:00:00Z", error: "HTTP 404" }],
    candidate: {
      type: "relocated",
      url: "https://example.com/new",
      method: "http-redirect",
      dateFound: true,
    },
    decision: "relocate",
  };

  const body = formatHealPrBody(report, 634);
  assert.match(body, /Fixes #634/);
  assert.match(body, /https:\/\/example\.com\/new/);
  assert.match(body, /"decision": "relocate"/);
});

test("formatHealPrBody formats archived source PR body", () => {
  const report: HealReport = {
    schemaVersion: "ebb.source-heal.v1",
    healedAt: "2026-11-27T10:00:00Z",
    oldUrl: "https://example.com/dead",
    failures: [{ timestamp: "2026-11-26T00:00:00Z", error: "HTTP 404" }],
    candidate: {
      type: "archive",
      url: "https://web.archive.org/web/20260101000000/https://example.com/dead",
      method: "wayback-availability",
      dateFound: true,
      archivedAt: "2026-01-01",
    },
    decision: "archive",
  };

  const body = formatHealPrBody(report);
  assert.doesNotMatch(body, /Fixes #/);
  assert.match(body, /web\.archive\.org/);
  assert.match(body, /"decision": "archive"/);
});
