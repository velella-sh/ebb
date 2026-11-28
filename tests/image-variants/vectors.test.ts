import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import {
  baseImageOf,
  codename,
  codenamesOf,
  type CodenameFamily,
  type ImageVariantTable,
} from "../../src/image-variants.js";
import { isIsoDate, type RegistryV2 } from "../../src/registry.js";
import { measureFreshness } from "../../tools/importers/freshness.js";

test("image lookup conformance vectors cover exact tags, verified digests, and release names", async () => {
  const file = await readFile("conformance/vectors/image-variants.json", "utf8");
  const vectors = JSON.parse(file) as {
    images: { name: string; tag: string; section: string; expected: [string, string, string | null] | null }[];
    codenames: { family: CodenameFamily; name: string; section: string; version: string | null }[];
  };
  for (const { name, tag, section, expected } of vectors.images) {
    const actual = baseImageOf(`pkg:docker/library/${name}`, tag);
    assert.equal(section, "#image-variants");
    if (!expected) {
      assert.deepEqual(actual, { status: "unknown" }, `${name}:${tag}`);
      continue;
    }
    assert.equal(actual.status, "known", `${name}:${tag}`);
    assert.deepEqual([actual.family, actual.version, actual.codename], expected, `${name}:${tag}`);
    assert.equal(actual.purl, `pkg:generic/${actual.family}`);
    assert.equal(actual.source.path, `library/${name}`);
    if (tag.includes("@")) assert.equal(actual.digestEvidence?.digest, tag.split("@")[1]);
  }
  for (const { family, name, section, version } of vectors.codenames) {
    assert.equal(section, "#release-codenames");
    assert.equal(codename(family, name)?.version ?? null, version, name);
    assert.ok(codenamesOf(family).every((entry) => entry.family === family));
  }
});

test("published variants validate and account for every official image in the rules", async () => {
  const schema = JSON.parse(await readFile("schemas/image-variants.v1.schema.json", "utf8"));
  const table = JSON.parse(await readFile("registry/tables/image-variants.json", "utf8")) as ImageVariantTable;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.ok(validate(table), JSON.stringify(validate.errors));
  assert.ok(table.snapshot);
  assert.ok(isIsoDate(table.snapshot.accessedAt));
  const container = JSON.parse(await readFile("registry/container.json", "utf8")) as RegistryV2;
  const paths = [
    ...new Set(
      container.rules.flatMap(({ purl }) => {
        const path = /^pkg:docker\/(library\/.+)$/.exec(purl)?.[1];
        return path ? [path] : [];
      }),
    ),
  ].sort();
  assert.deepEqual(Object.keys(table.snapshot.files), paths);
  assert.equal(new Set(table.rows.map(({ imagePurl, tag }) => `${imagePurl}@${tag}`)).size, table.rows.length);
  assert.ok(table.rows.every(({ source }) => source.commit === table.snapshot?.commit));
  const docs = await readFile("docs/image-variants.md", "utf8");
  const mapped = new Set(table.rows.map(({ source }) => source.path));
  for (const path of paths.filter((path) => !mapped.has(path)))
    assert.match(docs.toLowerCase(), new RegExp(path.split("/")[1]!));
  const fresh = measureFreshness([], { maxAgeDays: { "image-variants": 7 } }, table.snapshot.accessedAt, [], table);
  assert.equal(fresh.sources[0]?.status, "met");

  if (table.snapshot.commit === "c788a3606c4d0231711ae26d9e6de137e60d1002") {
    for (const name of ["node", "python", "postgres"]) {
      const fixture = await readFile(`tests/fixtures/official-images/${name}`);
      assert.equal(table.snapshot.files[`library/${name}`], createHash("sha256").update(fixture).digest("hex"));
    }
  }
});

test("the image variants guide looks up the Debian announcement through the exported reader", async () => {
  const doc = await readFile("docs/image-variants.md", "utf8");
  const snippet = /\x60\x60\x60js\n([\s\S]+?)\n\x60\x60\x60/.exec(doc)?.[1];
  assert.ok(snippet);
  const date = execFileSync(process.execPath, ["--input-type=module", "--eval", snippet], { encoding: "utf8" });
  assert.equal(date.trim(), "2028-06-30");
});
