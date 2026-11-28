import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { importImageVariants } from "../../tools/importers/image-variants.js";
import type { CodenameRow } from "../../tools/importers/image-variants.js";

const commit = "c788a3606c4d0231711ae26d9e6de137e60d1002";
const raw = `https://raw.githubusercontent.com/docker-library/official-images/${commit}/library`;
const hashes = {
  node: "5f981709b00cbbf582aca667d615b762bc0cdc79a80a630f3a27ba8211a84c58",
  python: "c56ab44471f12ddff1ee38203358f448b90bcbeca3aec64bd7b595f1d11dd265",
  postgres: "3636bbe1f13be70c9aa9a5600dd34126309a789037d01ca9492b3ebf7b990a1d",
};
const codenames = JSON.parse(await readFile("registry/tables/codenames.json", "utf8")) as { rows: CodenameRow[] };

async function readFixture(name: keyof typeof hashes) {
  const bytes = await readFile(`tests/fixtures/official-images/${name}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), hashes[name]);
  return importImageVariants(
    { fetchText: async (url) => (assert.equal(url, `${raw}/${name}`), bytes.toString("utf8")) },
    name,
    commit,
    codenames.rows,
  );
}

test("pinned official Node, Python and Postgres library files provide exact known tag rows", async () => {
  const [node, python, postgres] = await Promise.all([
    readFixture("node"),
    readFixture("python"),
    readFixture("postgres"),
  ]);
  const schema = JSON.parse(await readFile("schemas/image-variants.v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const docs = await readFile("docs/formats/image-variants.v1.md", "utf8");
  const imageExample = JSON.parse(/```json\n([\s\S]+?)\n```/.exec(docs)![1]!);
  for (const data of [node, python, postgres, imageExample]) {
    assert.ok(validate(data), JSON.stringify(validate.errors));
  }
  assert.ok(!validate({ schemaVersion: node.schemaVersion, rows: [{ ...node.rows[0], deadline: "2028-01-01" }] }));
  const row = node.rows[0]!;
  assert.ok(!validate({ ...node, rows: [{ ...row, baseOs: { ...row.baseOs, purl: "pkg:generic/ubuntu" } }] }));
  for (const data of [node, python, postgres]) {
    assert.deepEqual(
      data.rows.map((row) => row.tag),
      [...new Set(data.rows.map((row) => row.tag))].sort(),
    );
    assert.ok(data.rows.every((row) => row.source.commit === commit));
  }
  assert.deepEqual(imageExample.rows, [
    node.rows.find((row) => row.tag === "22"),
    python.rows.find((row) => row.tag === "3.12-slim-bookworm"),
    postgres.rows.find((row) => row.tag === "17-alpine3.23"),
  ]);
  const known = (data: typeof node, tag: string) => data.rows.find((row) => row.tag === tag);
  assert.equal(known(node, "22")?.baseOs.version, "12");
  assert.equal(known(node, "lts")?.baseOs.codename, "trixie");
  assert.equal(known(node, "22-bookworm-slim")?.baseOs.codename, "bookworm");
  assert.equal(known(python, "3.15-trixie")?.sharedTags.includes("latest"), true);
  assert.equal(known(python, "latest"), undefined, "the shared tag includes unsupported Windows directories");
  assert.equal(known(node, "fake-bookworm"), undefined);
  assert.equal(known(postgres, "17-alpine3.23")?.baseOs.purl, "pkg:generic/alpine");
});

test("an alias resolves only if every upstream stanza and architecture points to the same OS", async () => {
  // Grammar regression input. Authoritative tag evidence comes from the pinned files above.
  const data = await importImageVariants(
    {
      fetchText: async () =>
        `Maintainers: test\nDirectory: bookworm\n\nTags: a\nSharedTags: common, mixed\n\nTags: b\nSharedTags: common\nArchitectures: arm64v8\n\nTags: c\nSharedTags: mixed\nArchitectures: amd64, arm64v8\narm64v8-Directory: noble\n`,
    },
    "fixture",
    commit,
    codenames.rows,
  );
  assert.deepEqual(
    data.rows.map((row) => row.tag),
    ["a", "b", "common"],
  );
  assert.deepEqual(data.rows.find((row) => row.tag === "common")?.architectures, ["amd64", "arm64v8"]);
  await assert.rejects(
    importImageVariants(
      { fetchText: async () => assert.fail("invalid source fetched") },
      "../bad",
      commit,
      codenames.rows,
    ),
    /official image name and full Git SHA/,
  );
});
