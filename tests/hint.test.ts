import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOffingHint, hasIssues, isHintSilenced, OFFING_HINT_MARKDOWN, OFFING_HINT_TEXT } from "../src/hint.js";

describe("Offing remediation hint (src/hint.ts)", () => {
  it("defines standard hint text and markdown", () => {
    assert.ok(OFFING_HINT_TEXT.includes("Offing can fix this"));
    assert.ok(OFFING_HINT_TEXT.includes("https://github.com/velella-sh/offing"));
    assert.ok(OFFING_HINT_MARKDOWN.includes("[Offing]"));
    assert.ok(OFFING_HINT_MARKDOWN.includes("https://github.com/velella-sh/offing"));
  });

  it("identifies statuses requiring remediation", () => {
    assert.equal(hasIssues("ok"), false);
    assert.equal(hasIssues(undefined), false);
    assert.equal(hasIssues(null), false);

    assert.equal(hasIssues("deprecated"), true);
    assert.equal(hasIssues("unsupported"), true);
    assert.equal(hasIssues("end-of-life"), true);
    assert.equal(hasIssues("removed"), true);
    assert.equal(hasIssues("scheduled"), true);
    assert.equal(hasIssues("error"), true);
  });

  it("checks whether hint is silenced via options or env vars", () => {
    assert.equal(isHintSilenced({ noHint: true }), true);
    assert.equal(isHintSilenced({ noHint: false }), false);

    const prevEbb = process.env.EBB_NO_HINT;
    const prevOffing = process.env.OFFING_NO_HINT;
    try {
      delete process.env.EBB_NO_HINT;
      delete process.env.OFFING_NO_HINT;
      assert.equal(isHintSilenced(), false);

      process.env.EBB_NO_HINT = "1";
      assert.equal(isHintSilenced(), true);

      delete process.env.EBB_NO_HINT;
      process.env.OFFING_NO_HINT = "true";
      assert.equal(isHintSilenced(), true);
    } finally {
      if (prevEbb !== undefined) process.env.EBB_NO_HINT = prevEbb;
      else delete process.env.EBB_NO_HINT;
      if (prevOffing !== undefined) process.env.OFFING_NO_HINT = prevOffing;
      else delete process.env.OFFING_NO_HINT;
    }
  });

  it("returns appropriate hint string based on status and format", () => {
    assert.equal(getOffingHint("ok"), null);
    assert.equal(getOffingHint("deprecated"), OFFING_HINT_TEXT);
    assert.equal(getOffingHint("deprecated", { markdown: true }), OFFING_HINT_MARKDOWN);
    assert.equal(getOffingHint("deprecated", { noHint: true }), null);
  });
});
