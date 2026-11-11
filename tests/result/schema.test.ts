import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { check } from "../../src/check.js";
import { readCases } from "../../tools/rule-cases.js";

/** Fixed calendar day so daysLeft stays clock-free in tests. */
const AS_OF = "2026-04-01";

async function compileResultSchema() {
  const schema = JSON.parse(await readFile(resolve("schemas/result.v1.schema.json"), "utf8")) as object;
  const ajv = new Ajv2020({ allErrors: true });
  return { ajv, validate: ajv.compile(schema) };
}

test("every check output on cases/ validates against result.v1.schema.json", async () => {
  const { ajv, validate } = await compileResultSchema();
  const files = await readCases(".");
  assert.ok(files.size > 0, "cases/ holds at least one file");

  let checked = 0;
  const failures: string[] = [];

  for (const [file, cases] of files) {
    for (const item of cases) {
      checked += 1;
      for (const [variant, result] of [
        ["without asOf", check(item.purl, item.version)],
        [`asOf=${AS_OF}`, check(item.purl, item.version, AS_OF)],
      ] as const) {
        if (result.schemaVersion !== 1) {
          failures.push(`${file}: ${item.purl}@${item.version} (${variant}): expected schemaVersion 1`);
        }
        if (!validate(result)) {
          failures.push(`${file}: ${item.purl}@${item.version} (${variant}): ${ajv.errorsText(validate.errors)}`);
        }
      }
    }
  }

  assert.ok(checked > 0, "cases/ holds at least one case");
  assert.deepEqual(failures, []);
});
