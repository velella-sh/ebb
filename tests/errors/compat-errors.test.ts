import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EbbError } from "../../src/errors.js";
import { fromLookupProduct } from "../../src/result-compat.js";
import { lookupProduct } from "../../src/lookup.js";

describe("result-compat errors", () => {
  it("throws EbbError(internal) when version is missing or empty", async () => {
    const valid = await lookupProduct("node", "18.0.0");
    const noVersion = { ...valid, query: { name: "node" } };
    delete (noVersion as { version?: string }).version;
    assert.throws(
      () => fromLookupProduct(noVersion),
      (err: unknown) => {
        assert.ok(err instanceof EbbError);
        assert.equal(err.code, "internal");
        assert.match(err.message, /Cannot map LookupResult to Result without a non-empty version\./);
        return true;
      },
    );
  });

  it("throws EbbError(internal) when finding ruleId is unknown in active rules", async () => {
    const valid = await lookupProduct("node", "18.0.0");
    const firstFinding = valid.findings[0];
    assert.ok(firstFinding, "expected node 18.0.0 to have at least one finding");
    const fakeFinding = {
      ...valid,
      findings: [{ ...firstFinding, ruleId: "nonexistent.unknown.rule.id" }],
    };
    assert.throws(
      () => fromLookupProduct(fakeFinding),
      (err: unknown) => {
        assert.ok(err instanceof EbbError);
        assert.equal(err.code, "internal");
        assert.match(err.message, /missing active rule provenance for reviewedAt\./);
        return true;
      },
    );
  });
});
