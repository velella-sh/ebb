import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { isIsoDate } from "../../src/registry.js";
import type { CodenameRow } from "../../tools/importers/image-variants.js";

test("the v1 codename table validates and contains the historic and named release lines", async () => {
  const schema = JSON.parse(await readFile("schemas/codenames.v1.schema.json", "utf8"));
  const data = JSON.parse(await readFile("registry/tables/codenames.json", "utf8")) as { rows: CodenameRow[] };
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.ok(validate(data), JSON.stringify(validate.errors));
  const rows = new Map(data.rows.map((row) => [`${row.family}/${row.codename}`, row]));
  assert.equal(rows.size, data.rows.length, "family and codename must uniquely identify a row");
  for (const [key, version] of Object.entries({
    "debian/jessie": "8",
    "debian/bookworm": "12",
    "ubuntu/trusty": "14.04",
    "ubuntu/noble": "24.04",
    "ubuntu/stonking": "26.10",
    "nodejs-lts/argon": "4",
    "nodejs-lts/iron": "20",
  })) {
    assert.equal(rows.get(key)?.version, version, key);
  }
  for (const row of data.rows) assert.ok(isIsoDate(row.source.accessedAt), row.codename);
  const docs = await readFile("docs/formats/image-variants.v1.md", "utf8");
  const examples = [...docs.matchAll(/```json\n([\s\S]+?)\n```/g)];
  const example = JSON.parse(examples[1]![1]!);
  assert.ok(validate(example), JSON.stringify(validate.errors));
  assert.deepEqual(example, { schemaVersion: "ebb.codenames.v1", rows: [rows.get("debian/bookworm")] });
  assert.ok(!validate({ ...data, rows: [{ ...rows.get("debian/bookworm"), endOfLife: "2028-01-01" }] }));
  assert.ok(!validate({ ...data, rows: [{ ...rows.get("ubuntu/noble"), version: "24" }] }));
});
