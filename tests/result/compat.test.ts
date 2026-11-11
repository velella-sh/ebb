import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { check } from "../../src/check.js";
import { LookupError, type LookupResult, lookupProduct } from "../../src/lookup.js";
import { fromLookupProduct } from "../../src/result-compat.js";
import { readCases } from "../../tools/rule-cases.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

async function loadSchemaValidator() {
  const schema = JSON.parse(await readFile(resolve("schemas/result.v1.schema.json"), "utf8")) as Record<
    string,
    unknown
  >;
  return new Ajv2020({ allErrors: true }).compile(schema);
}

test("fromLookupProduct equals check and passes result.v1 schema on every case in cases/", async () => {
  const files = await readCases(".");
  assert.ok(files.size > 0, "cases/ holds at least one file");

  const validate = await loadSchemaValidator();
  let mappedCount = 0;

  for (const [file, cases] of files) {
    for (const item of cases) {
      const label = `${file}: ${item.purl}@${item.version}`;
      let old: LookupResult;
      try {
        old = await lookupProduct(item.purl, item.version);
      } catch (error) {
        // Unknown products throw LookupError in lookupProduct whereas check returns ok with empty matches.
        if (error instanceof LookupError && /Unknown product/.test(error.message)) {
          const direct = check(item.purl, item.version);
          assert.equal(direct.status, "ok", `${label}: unknown product must be ok in check`);
          assert.deepEqual(direct.matches, []);
          continue;
        }
        throw error;
      }

      mappedCount += 1;
      for (const [variant, mapped, expected] of [
        ["no asOf", fromLookupProduct(old), check(item.purl, item.version)],
        ["with asOf", fromLookupProduct(old, AS_OF), check(item.purl, item.version, AS_OF)],
      ] as const) {
        assert.deepEqual(mapped, expected, `${label} (${variant})`);
        assert.equal(validate(mapped), true, `${label} (${variant}): ${JSON.stringify(validate.errors)}`);
      }
    }
  }

  assert.ok(mappedCount >= 25, `expected at least 25 mapped cases, got ${mappedCount}`);
});

test("fromLookupProduct maps supported products and product-name queries like check", async () => {
  const safe = await lookupProduct("pkg:generic/nodejs", "24.0.0");
  assert.equal(safe.status, "supported");
  assert.deepEqual(fromLookupProduct(safe), check("pkg:generic/nodejs", "24.0.0"));
  assert.deepEqual(fromLookupProduct(safe, AS_OF), check("pkg:generic/nodejs", "24.0.0", AS_OF));

  for (const [name, version] of [
    ["node", "18.20.4"],
    ["node", "22.0.0"],
    ["left-pad", "1.3.0"],
    ["python", "3.13.0"],
  ] as const) {
    const old = await lookupProduct(name, version);
    assert.deepEqual(fromLookupProduct(old), check(name, version), `${name}@${version} (no asOf)`);
    assert.deepEqual(fromLookupProduct(old, AS_OF), check(name, version, AS_OF), `${name}@${version} (asOf)`);
  }
});

test("fromLookupProduct rejects missing versions, invalid asOf dates, and unknown finding ruleIds", async () => {
  const withoutVersion = await lookupProduct("node");
  assert.throws(() => fromLookupProduct(withoutVersion), /version/i);

  const safe = await lookupProduct("pkg:generic/nodejs", "24.0.0");
  assert.throws(() => fromLookupProduct(safe, "2026-02-30"), /not a date/i);

  const ended = await lookupProduct("node", "18.20.4");
  const synthetic: LookupResult = {
    ...ended,
    findings: [{ ...ended.findings[0]!, ruleId: "synthetic.unknown.rule" }],
  };
  assert.throws(() => fromLookupProduct(synthetic), /reviewedAt/);
});
