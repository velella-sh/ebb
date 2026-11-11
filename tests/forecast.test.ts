import assert from "node:assert/strict";
import { test } from "node:test";
import type { LifecycleScan } from "../src/domain.js";
import { addDays, addMonths, buildForecast, renderForecastText } from "../src/forecast.js";
import type { RegistryV2Rule } from "../src/registry.js";

function makeRule(overrides: Partial<RegistryV2Rule> = {}): RegistryV2Rule {
  return {
    id: "nodejs.runtime.eol-20",
    ecosystem: "nodejs",
    purl: "pkg:generic/nodejs",
    vers: "vers:semver/>=20.0.0|<21.0.0",
    event: "end-of-life",
    title: "Node.js 20 reaches end of life",
    summary: "Node.js 20 is EOL.",
    severity: "high",
    deadline: "2026-04-30",
    sources: [{ title: "Node.js schedule", url: "https://nodejs.org/schedule", accessedAt: "2026-01-01" }],
    provenance: { observedAt: "2026-01-01", reviewedAt: "2026-01-02", reviewer: "test" },
    ...overrides,
  };
}

test("addDays and addMonths advance UTC ISO calendar dates", () => {
  assert.equal(addDays("2026-01-30", 3), "2026-02-02");
  assert.equal(addMonths("2026-01-15", 12), "2027-01-15");
});

test("buildForecast groups window events, includes unlisted rule deadlines, and rejects invalid today", () => {
  assert.throws(() => buildForecast({ root: ".", findings: [] }, [], "2026-99-99"), /is not a date/);

  const scan: LifecycleScan = {
    root: "/repo",
    findings: [
      {
        id: "f1",
        ruleId: "nodejs.runtime.eol-20",
        detector: "nodejs",
        title: "Node.js 20",
        summary: "Ends soon",
        severity: "medium",
        location: { path: ".nvmrc", line: 1 },
        sources: [{ title: "Node.js", url: "https://nodejs.org", accessedAt: "2026-01-01" }],
      },
      {
        id: "f2",
        ruleId: "custom.unlisted.rule",
        detector: "custom",
        title: "Custom unlisted rule",
        summary: "Custom deadline",
        severity: "low",
        location: { path: "Dockerfile" },
        deadline: "2026-06-15",
        sources: [],
      },
    ],
  };

  const nodate = makeRule({ id: "nodejs.runtime.nodate" });
  delete nodate.deadline;
  const rules: RegistryV2Rule[] = [
    makeRule({ id: "nodejs.runtime.eol-20", deadline: "2026-04-30" }),
    makeRule({ id: "python.runtime.eol-310", ecosystem: "python", title: "Python 3.10", deadline: "2026-04-10" }),
    makeRule({ id: "nodejs.runtime.eol-18", deadline: "2025-04-30" }),
    nodate,
  ];

  const forecast = buildForecast(scan, rules, "2026-04-01", 6);
  assert.equal(forecast.schemaVersion, "ebb.forecast.v1");
  assert.equal(forecast.until, "2026-10-01");
  assert.equal(forecast.total, 3);
  assert.equal(forecast.affecting, 2);
  assert.deepEqual(
    forecast.groups.map((g) => g.month),
    ["2026-04", "2026-06"],
  );
  assert.deepEqual(
    forecast.groups[0]!.events.map((e) => e.ruleId),
    ["python.runtime.eol-310", "nodejs.runtime.eol-20"],
  );
  assert.deepEqual(forecast.groups[0]!.events[1]!.findings, [{ id: "f1", path: ".nvmrc", line: 1 }]);
  assert.equal(forecast.groups[1]!.events[0]!.source, "");
  assert.deepEqual(forecast.groups[1]!.events[0]!.findings, [{ id: "f2", path: "Dockerfile" }]);

  const text = renderForecastText(forecast);
  assert.match(text, /Forecast from 2026-04-01 to 2026-10-01 \(6 months\)/);
  assert.match(text, /\.nvmrc:1/);
  assert.match(text, /Dockerfile/);
  assert.match(text, /1 other dated event in the window/);
});

test("renderForecastText handles empty affecting events and singular months/others", () => {
  const forecast = buildForecast({ root: ".", findings: [] }, [], "2026-04-01", 1);
  const text = renderForecastText(forecast);
  assert.match(text, /\(1 month\)/);
  assert.match(text, /Nothing in this repository reaches a dated end of life in this window\./);
  assert.match(text, /0 other dated events/);
});
