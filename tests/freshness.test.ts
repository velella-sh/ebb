import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DATA_STATUS_SCHEMA_VERSION, STALE_AFTER_DAYS, dataStatus } from "../src/data-status.js";
import { formatCheckMarkdown, formatCheckText } from "../src/cli/format/index.js";
import { check } from "../src/check.js";

describe("freshness: dataStatus unit tests with fixed clock", () => {
  it("evaluates dataStatus using a fixed date string", () => {
    // Bundled reviewedThrough is 2026-11-15
    const status = dataStatus({ now: "2026-11-18T00:00:00Z" });
    assert.equal(status.schemaVersion, DATA_STATUS_SCHEMA_VERSION);
    assert.equal(status.source, "bundled");
    assert.equal(status.reviewedThrough, "2026-11-15");
    assert.equal(status.ageDays, 3);
    assert.equal(status.staleAfterDays, STALE_AFTER_DAYS);
    assert.equal(status.stale, false);
    assert.deepEqual(status.warnings, []);
  });

  it("evaluates dataStatus using an injected clock function", () => {
    const fixedTime = new Date("2026-11-25T12:00:00Z");
    const status = dataStatus({ clock: () => fixedTime });
    assert.equal(status.ageDays, 10);
    assert.equal(status.stale, false);
  });

  it("marks data as stale when age exceeds the 30-day default window", () => {
    // 35 days after 2026-11-15 is 2026-12-20
    const status = dataStatus({ now: "2026-12-20T12:00:00Z" });
    assert.equal(status.ageDays, 35);
    assert.equal(status.stale, true);
    assert.ok(status.warnings.some((w) => w.includes("exceeds 30d freshness threshold")));
  });

  it("respects custom maxAgeDays option", () => {
    const status = dataStatus({ now: "2026-11-18T00:00:00Z", maxAgeDays: 2 });
    assert.equal(status.staleAfterDays, 2);
    assert.equal(status.ageDays, 3);
    assert.equal(status.stale, true);
    assert.ok(status.warnings.some((w) => w.includes("exceeds 2d freshness threshold")));
  });

  it("respects EBB_DATA_MAX_AGE_DAYS environment variable", () => {
    const prev = process.env.EBB_DATA_MAX_AGE_DAYS;
    try {
      process.env.EBB_DATA_MAX_AGE_DAYS = "1";
      const status = dataStatus({ now: "2026-11-18T00:00:00Z" });
      assert.equal(status.staleAfterDays, 1);
      assert.equal(status.stale, true);
    } finally {
      if (prev === undefined) {
        delete process.env.EBB_DATA_MAX_AGE_DAYS;
      } else {
        process.env.EBB_DATA_MAX_AGE_DAYS = prev;
      }
    }
  });
});

describe("freshness: CLI footer formatting", () => {
  it("includes data freshness footer in text format", () => {
    const res = check("pkg:npm/request", "2.88.2");
    const status = dataStatus({ now: "2026-11-18T00:00:00Z" });
    const formatted = formatCheckText("pkg:npm/request", "2.88.2", res, { dataStatus: status });
    assert.match(formatted, /Data: bundled \(\d+\.\d+\.\d+\), 3d old \(reviewed 2026-11-15\)/);
  });

  it("includes stale warning in text format when threshold is exceeded", () => {
    const res = check("pkg:npm/request", "2.88.2");
    const status = dataStatus({ now: "2026-12-20T00:00:00Z" });
    const formatted = formatCheckText("pkg:npm/request", "2.88.2", res, { dataStatus: status });
    assert.match(formatted, /⚠ Warning: Data is 35d old \(exceeds 30d threshold\)\. Run 'ebb update' to refresh\./);
  });

  it("includes data freshness footer and warning in markdown format", () => {
    const res = check("pkg:npm/request", "2.88.2");
    const status = dataStatus({ now: "2026-12-20T00:00:00Z" });
    const formatted = formatCheckMarkdown("pkg:npm/request", "2.88.2", res, { dataStatus: status });
    assert.match(formatted, /\*Lifecycle data: bundled \(\d+\.\d+\.\d+\) · 35d old \(reviewed through 2026-11-15\)\*/);
    assert.match(formatted, /> ⚠️ \*\*Warning:\*\* Lifecycle data is 35 days old \(exceeds 30d freshness threshold\)\./);
  });
});
