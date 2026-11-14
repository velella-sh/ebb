import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asOf, type CheckResult } from "../src/index.js";
import { EbbError } from "../src/errors.js";
import { runCli } from "../src/cli.js";
import type { RegistryV2Rule } from "../src/registry.js";

function createMockIo() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: {
        write: (chunk: string) => {
          stdout += chunk;
          return true;
        },
      },
      stderr: {
        write: (chunk: string) => {
          stderr += chunk;
          return true;
        },
      },
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

describe("asOf scoped client", () => {
  it("validates and accepts ISO UTC dates, rejecting invalid dates", () => {
    // Valid dates
    const client = asOf("2026-04-01");
    assert.equal(client.asOf, "2026-04-01");

    // Leap year date is valid
    const leapClient = asOf("2024-02-29");
    assert.equal(leapClient.asOf, "2024-02-29");

    // Invalid dates throw typed EbbError with "invalid-date"
    assert.throws(
      () => asOf("not-a-date"),
      (err: unknown) => err instanceof EbbError && err.code === "invalid-date",
    );
    assert.throws(
      () => asOf("2026-02-30"),
      (err: unknown) => err instanceof EbbError && err.code === "invalid-date",
    );
    assert.throws(
      () => asOf("2026-04-01T00:00:00Z"),
      (err: unknown) => err instanceof EbbError && err.code === "invalid-date",
    );
    assert.throws(
      () => asOf("2026/04/01"),
      (err: unknown) => err instanceof EbbError && err.code === "invalid-date",
    );
    assert.throws(
      () => asOf(""),
      (err: unknown) => err instanceof EbbError && err.code === "invalid-date",
    );
  });

  it("hides rules observed after the given date", () => {
    // nodejs.runtime.eol-20 was observed on 2026-10-17
    // Querying as of 2026-10-12 (before observedAt) must hide the rule completely
    const pastClient = asOf("2026-10-12");
    const pastResult = pastClient.check("node", "20.0.0");
    assert.equal(pastResult.status, "ok");
    assert.equal(pastResult.matches.length, 0);

    // Querying on or after 2026-10-17 must reveal the rule
    const presentClient = asOf("2026-10-17");
    const presentResult = presentClient.check("node", "20.0.0");
    assert.equal(presentResult.status, "end-of-life");
    assert.ok(presentResult.matches.some((m) => m.ruleId === "nodejs.runtime.eol-20"));
  });

  it("tests five past dates for reproducible, deterministic replay", () => {
    // 5 past dates across the timeline
    const pastDates = [
      "2026-10-12", // Before any nodejs rules observed
      "2026-10-14", // After left-pad (2026-10-13) but before nodejs (2026-10-17)
      "2026-10-18", // After node 20 (2026-10-17) but before node 22 (2026-10-24)
      "2026-10-25", // After node 22 scheduled (2026-10-24)
      "2026-11-01", // Stable snapshot
    ];

    for (const pastDate of pastDates) {
      const clientA = asOf(pastDate);
      const clientB = asOf(pastDate);

      // Replay check reproducibility
      const resA1 = clientA.check("node", "20.0.0");
      const resA2 = clientB.check("node", "20.0.0");
      assert.deepEqual(resA1, resA2, `Expected identical result for replay on ${pastDate}`);

      const leftPadA = clientA.check("pkg:npm/left-pad", "1.3.0");
      const leftPadB = clientB.check("pkg:npm/left-pad", "1.3.0");
      assert.deepEqual(leftPadA, leftPadB, `Expected identical result for left-pad on ${pastDate}`);
    }

    // Verify progression across the past dates
    // Date 1: 2026-10-12 -> neither left-pad nor node 20 is observed yet
    assert.equal(asOf("2026-10-12").check("pkg:npm/left-pad", "1.3.0").status, "ok");
    assert.equal(asOf("2026-10-12").check("node", "20.0.0").status, "ok");

    // Date 2: 2026-10-14 -> left-pad is deprecated (observed 2026-10-13), node 20 not observed yet
    assert.equal(asOf("2026-10-14").check("pkg:npm/left-pad", "1.3.0").status, "deprecated");
    assert.equal(asOf("2026-10-14").check("node", "20.0.0").status, "ok");

    // Date 3: 2026-10-18 -> node 20 is end-of-life (observed 2026-10-17), node 22 not observed yet
    assert.equal(asOf("2026-10-18").check("node", "20.0.0").status, "end-of-life");
    assert.equal(asOf("2026-10-18").check("node", "22.11.0").status, "ok");

    // Date 4: 2026-10-25 -> node 22 scheduled rule observed (observed 2026-10-24)
    assert.equal(asOf("2026-10-25").check("node", "22.11.0").status, "scheduled");

    // Date 5: 2026-11-01 -> unchanged state
    assert.equal(asOf("2026-11-01").check("node", "22.11.0").status, "scheduled");
  });

  it("judges scheduled events across a deadline boundary", () => {
    // nodejs.runtime.eol-22 deadline is 2027-04-30
    // 1. Day before deadline: 2027-04-29
    const dayBefore = asOf("2027-04-29").check("node", "22.11.0");
    assert.equal(dayBefore.status, "scheduled");
    assert.equal(dayBefore.asOf, "2027-04-29");
    assert.equal(dayBefore.matches[0]?.event, "scheduled");
    assert.equal(dayBefore.matches[0]?.date, "2027-04-30");
    assert.equal(dayBefore.matches[0]?.daysLeft, 1);

    // 2. Day of deadline: 2027-04-30 (deadline reached)
    const dayOf = asOf("2027-04-30").check("node", "22.11.0");
    assert.equal(dayOf.status, "end-of-life");
    assert.equal(dayOf.asOf, "2027-04-30");
    assert.equal(dayOf.matches[0]?.event, "end-of-life");
    assert.equal(dayOf.matches[0]?.date, "2027-04-30");
    assert.equal(dayOf.matches[0]?.daysLeft, null);

    // 3. Day after deadline: 2027-05-01 (deadline passed)
    const dayAfter = asOf("2027-05-01").check("node", "22.11.0");
    assert.equal(dayAfter.status, "end-of-life");
    assert.equal(dayAfter.asOf, "2027-05-01");
    assert.equal(dayAfter.matches[0]?.event, "end-of-life");
    assert.equal(dayAfter.matches[0]?.date, "2027-04-30");
    assert.equal(dayAfter.matches[0]?.daysLeft, null);
  });

  it("accepts future dates for planning migrations", () => {
    // Planning for year 2028
    const futureClient = asOf("2028-01-01");
    const node22 = futureClient.check("node", "22.11.0");
    assert.equal(node22.status, "end-of-life");
    assert.equal(node22.asOf, "2028-01-01");
    assert.equal(node22.matches[0]?.event, "end-of-life");

    // Batch check for planning multiple dependencies
    const batch = futureClient.checkAll([
      { purl: "pkg:generic/nodejs", version: "22.11.0" },
      { purl: "pkg:npm/left-pad", version: "1.3.0" },
    ]);
    assert.equal(batch.summary.total, 2);
    assert.equal(batch.summary.byStatus["end-of-life"], 1);
    assert.equal(batch.summary.byStatus.deprecated, 1);
  });

  it("provides rulesFor, replacementFor, and upcoming on the client", () => {
    const client = asOf("2026-11-01");

    // replacementFor
    const replacement = client.replacementFor("pkg:npm/left-pad", "1.3.0");
    assert.equal(replacement, "String.prototype.padStart()");

    // rulesFor
    const rules = client.rulesFor("pkg:npm/left-pad");
    assert.ok(rules.length > 0);
    assert.equal(rules[0]?.id, "npm.package.left-pad.deprecated");

    // upcoming
    const up = client.upcoming({ within: "180d" });
    assert.equal(up.asOf, "2026-11-01");
    assert.ok(up.items.length > 0);
  });

  it("supports custom rules option", () => {
    const customRule: RegistryV2Rule = {
      id: "custom.test.rule",
      ecosystem: "npm",
      purl: "pkg:npm/custom-pkg",
      vers: "vers:npm/>=1.0.0",
      event: "scheduled-end-of-life",
      title: "Custom scheduled EOL",
      summary: "Custom summary",
      severity: "low",
      deadline: "2026-06-30",
      sources: [{ title: "Source", url: "https://example.com" }],
      provenance: {
        observedAt: "2026-01-01",
        reviewedAt: "2026-01-01",
        reviewer: "tester",
      },
    };

    // Before deadline
    const beforeClient = asOf("2026-03-01", { rules: [customRule] });
    const beforeRes = beforeClient.check("pkg:npm/custom-pkg", "1.5.0");
    assert.equal(beforeRes.status, "scheduled");
    assert.equal(beforeRes.matches[0]?.daysLeft, 121);

    // After deadline
    const afterClient = asOf("2026-07-01", { rules: [customRule] });
    const afterRes = afterClient.check("pkg:npm/custom-pkg", "1.5.0");
    assert.equal(afterRes.status, "end-of-life");
    assert.equal(afterRes.matches[0]?.daysLeft, null);

    // Before observed date -> hidden
    const unobservedClient = asOf("2025-12-31", { rules: [customRule] });
    const unobservedRes = unobservedClient.check("pkg:npm/custom-pkg", "1.5.0");
    assert.equal(unobservedRes.status, "ok");
  });
});

describe("CLI as-of support", () => {
  it("runs ebb as-of <date> <purl> [version] command", async () => {
    const mock = createMockIo();
    const code = await runCli(["as-of", "2027-05-01", "node", "22.11.0", "--no-color"], mock.io);
    assert.equal(code, 1); // end-of-life fails default fail-on: deprecated
    assert.ok(mock.stdout.includes("end-of-life"));
  });

  it("runs ebb as-of with --json output", async () => {
    const mock = createMockIo();
    const code = await runCli(["as-of", "2026-11-01", "pkg:npm/left-pad@1.3.0", "--json"], mock.io);
    assert.equal(code, 1);
    const parsed: CheckResult = JSON.parse(mock.stdout);
    assert.equal(parsed.status, "deprecated");
    assert.equal(parsed.asOf, "2026-11-01");
  });

  it("rejects invalid date on CLI as-of command with exit code 2", async () => {
    const mock = createMockIo();
    const code = await runCli(["as-of", "not-a-date", "node", "22.11.0"], mock.io);
    assert.equal(code, 2);
    assert.ok(mock.stderr.includes("is not a date (YYYY-MM-DD)"));
  });
});
