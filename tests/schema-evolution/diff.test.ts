import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { type ChangeClass, compareCatalogs, type Schema } from "../../tools/schema-evolution/diff.js";

interface Fixture {
  name: string;
  class: ChangeClass;
  pointer: string;
  before: Schema;
  after: Schema;
  instance: unknown;
  afterAccepts: boolean;
}

const file = "schemas/example.schema.json";
const catalog = (value: Schema) => new Map([[file, value]]);
const fixtures = JSON.parse(readFileSync("tests/schema-evolution/fixtures/changes.json", "utf8")) as Fixture[];

for (const fixture of fixtures) {
  test(fixture.name, () => {
    const validator = new Ajv2020();
    assert.ok(validator.compile(fixture.before)(fixture.instance));
    assert.equal(validator.compile(fixture.after)(fixture.instance), fixture.afterAccepts);
    const changes = compareCatalogs(catalog(fixture.before), catalog(fixture.after));
    assert.deepEqual(
      changes.map((change) => [change.class, change.pointer]),
      [[fixture.class, fixture.pointer]],
    );
  });
}

test("uses JSON pointer escapes and follows a retargeted local reference", () => {
  const defs = { "old/~": { type: "number" }, "new/~": { type: "integer" } };
  const a = { $defs: defs, $ref: "#/$defs/old~1~0" };
  const b = { $defs: defs, $ref: "#/$defs/new~1~0" };
  const changes = compareCatalogs(catalog(a), catalog(b));
  assert.deepEqual(
    changes.map((change) => [change.class, change.pointer]),
    [["breaking", "/$ref/type"]],
  );

  const changedDefinitions = compareCatalogs(
    catalog(a),
    catalog({ ...a, $defs: { ...defs, "old/~": { type: "integer" } } }),
  );
  assert.deepEqual(
    changedDefinitions.map((change) => change.pointer),
    ["/$defs/old~1~0/type"],
  );
});

test("checks sibling schemas locally and keeps changed external references unknown", () => {
  const dependency = "schemas/types.schema.json";
  const before = new Map<string, Schema>([
    [file, { $ref: "types.schema.json" }],
    [dependency, { $id: "https://example.invalid/schemas/types.schema.json", type: "number" }],
  ]);
  assert.equal(
    compareCatalogs(before, new Map(before).set(file, { $ref: "https://example.invalid/schemas/types.schema.json" }))[0]
      ?.class,
    "editorial",
  );
  assert.equal(
    compareCatalogs(before, new Map(before).set(file, { $ref: "https://remote.invalid/schema" }))[0]?.class,
    "unknown",
  );
  assert.equal(
    compareCatalogs(
      before,
      new Map(before).set(dependency, { $id: "https://example.invalid/renamed", type: "number" }),
    )[0]?.class,
    "breaking",
  );
});

test("conservatively handles open properties, pattern replacement and unordered validation arrays", () => {
  assert.equal(
    compareCatalogs(
      catalog({ type: "object" }),
      catalog({ type: "object", properties: { note: { type: "string" } } }),
    )[0]?.class,
    "unknown",
  );
  assert.equal(compareCatalogs(catalog({ pattern: "^pkg:" }), catalog({ pattern: "^pkg:npm/" }))[0]?.class, "unknown");
  assert.deepEqual(
    compareCatalogs(catalog({ enum: [1, 2], required: ["a", "b"] }), catalog({ enum: [2, 1], required: ["b", "a"] })),
    [],
  );
});

test("a new file cannot silently reuse a published canonical schema ID", () => {
  const published = { $id: "https://example.invalid/schema", type: "object" };
  const old = catalog(published);
  const after = new Map(old).set("schemas/second.schema.json", { ...published, type: "array" });
  const changes = compareCatalogs(old, after);
  assert.ok(changes.some(({ class: kind, pointer }) => kind === "unknown" && pointer === "/$id"));
});
