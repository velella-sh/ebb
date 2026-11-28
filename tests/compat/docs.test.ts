import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

test("the compatibility guide JavaScript examples run as shown", async () => {
  const markdown = await readFile("docs/runtime-support.md", "utf8");
  const examples = [...markdown.matchAll(/```js\n([\s\S]*?)\n```/g)];
  assert.ok(examples.length > 0);
  for (const [, example] of examples) {
    assert.ok(example);
    execFileSync(process.execPath, ["--input-type=module", "--eval", example]);
  }
});

test("format examples validate against the compatibility schema", async () => {
  const [markdown, schema] = await Promise.all([
    readFile("docs/formats/compat.v1.md", "utf8"),
    readFile("schemas/compat.v1.schema.json", "utf8"),
  ]);
  const rows = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map(([, json]) => JSON.parse(json!));
  assert.equal(rows.length, 3);
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(JSON.parse(schema));
  assert.ok(validate({ schemaVersion: "ebb.compat.v1", rows }), ajv.errorsText(validate.errors));
});
