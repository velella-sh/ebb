import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EbbError } from "../../src/errors.js";
import { asOf, supportedVersions } from "../../src/index.js";

describe("supportedVersions as of a date", () => {
  it("moves Node.js 22 from ending to ended across its deadline", () => {
    const before = supportedVersions("node", { asOf: "2027-04-29" });
    const onDate = supportedVersions("node", { asOf: "2027-04-30" });
    assert.equal(before.lines.find((line) => line.id === "22.x")?.status, "ending");
    assert.equal(before.lines.find((line) => line.id === "22.x")?.event, "scheduled-end-of-life");
    assert.equal(onDate.lines.find((line) => line.id === "22.x")?.status, "ended");
    assert.equal(onDate.lines.find((line) => line.id === "22.x")?.event, "end-of-life");
  });

  it("hides rules that had not been observed yet", () => {
    const past = supportedVersions("node", { asOf: "2020-01-01" });
    assert.deepEqual(past.lines, []);
    assert.equal(past.complete, false);
    assert.match(past.notes.join(" "), /as of this date/);
  });

  it("rejects a malformed date with the existing error", () => {
    assert.throws(
      () => supportedVersions("node", { asOf: "2026-13-40" }),
      (error: unknown) => error instanceof EbbError && error.code === "invalid-date",
    );
  });

  it("does not read the system clock when asOf is given", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2035-06-01T00:00:00.000Z") });
    const pinned = supportedVersions("node", { asOf: "2026-11-15" });
    assert.equal(pinned.lines.find((line) => line.id === "22.x")?.status, "ending");
    assert.equal(pinned.asOf, "2026-11-15");

    const fromClock = supportedVersions("node");
    assert.equal(fromClock.asOf, "2035-06-01");
    assert.equal(fromClock.lines.find((line) => line.id === "22.x")?.status, "ended");
  });

  it("is available on the asOf client", () => {
    const result = asOf("2026-11-15").supportedVersions("pkg:npm/request");
    assert.equal(result.asOf, "2026-11-15");
    assert.equal(result.lines[0]?.status, "ended");
    assert.equal(result.recommendation, null);
  });
});
