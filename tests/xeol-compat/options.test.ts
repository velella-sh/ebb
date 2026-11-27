import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  XEOL_EXIT_CLEAN,
  XEOL_EXIT_EOL_FOUND,
  XEOL_EXIT_INVALID_INPUT,
  determineExitCode,
  mapFailOption,
  mapLookahead,
} from "../../src/xeol/options.js";

describe("xeol-compat-4: Map lookahead and failure options", () => {
  const baseDate = "2026-01-01T00:00:00.000Z";

  describe("mapLookahead", () => {
    it("handles undefined and empty string", () => {
      assert.deepEqual(mapLookahead(undefined), {});
      assert.deepEqual(mapLookahead(""), {});
    });

    it("handles 'none'", () => {
      const res = mapLookahead("none", baseDate);
      assert.equal(res.asOf, "2026-01-01");
      assert.equal(res.windowDays, 0);
    });

    it("maps '1d' to 1 day ahead", () => {
      const res = mapLookahead("1d", baseDate);
      assert.equal(res.asOf, "2026-01-02");
      assert.equal(res.windowDays, 1);
    });

    it("maps '1w' to 7 days ahead", () => {
      const res = mapLookahead("1w", baseDate);
      assert.equal(res.asOf, "2026-01-08");
      assert.equal(res.windowDays, 7);
    });

    it("maps '1m' to 30 days ahead", () => {
      const res = mapLookahead("1m", baseDate);
      assert.equal(res.asOf, "2026-01-31");
      assert.equal(res.windowDays, 30);
    });

    it("maps '1y' to 365 days ahead", () => {
      const res = mapLookahead("1y", baseDate);
      assert.equal(res.asOf, "2027-01-01");
      assert.equal(res.windowDays, 365);
    });

    it("maps compound amounts like '3m' and '2w'", () => {
      const resM = mapLookahead("3m", baseDate);
      assert.equal(resM.windowDays, 90);

      const resW = mapLookahead("2w", baseDate);
      assert.equal(resW.windowDays, 14);
    });

    it("throws on invalid lookahead specifier", () => {
      assert.throws(() => mapLookahead("invalid", baseDate), /bad --lookahead value: 'invalid'/);
      assert.throws(() => mapLookahead("10x", baseDate), /bad --lookahead value: '10x'/);
      assert.throws(() => mapLookahead("d", baseDate), /bad --lookahead value: 'd'/);
    });
  });

  describe("mapFailOption", () => {
    it("maps failOnEolFound boolean to Ebb --fail-on", () => {
      assert.equal(mapFailOption(true), "end-of-life");
      assert.equal(mapFailOption(false), undefined);
      assert.equal(mapFailOption(undefined), undefined);
    });
  });

  describe("exit codes", () => {
    it("has expected xeol exit codes", () => {
      assert.equal(XEOL_EXIT_CLEAN, 0);
      assert.equal(XEOL_EXIT_EOL_FOUND, 1);
      assert.equal(XEOL_EXIT_INVALID_INPUT, 1);
    });

    it("computes exit code based on EOL finding and flag", () => {
      assert.equal(determineExitCode({ hasEol: true, failOnEolFound: true }), 1);
      assert.equal(determineExitCode({ hasEol: true, failOnEolFound: false }), 0);
      assert.equal(determineExitCode({ hasEol: false, failOnEolFound: true }), 0);
      assert.equal(determineExitCode({ hasEol: false, failOnEolFound: false }), 0);
    });

    it("returns exit code 1 for invalid input", () => {
      assert.equal(determineExitCode({ isInvalid: true }), 1);
    });
  });
});
