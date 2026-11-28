import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readEolDateIds } from "../../tools/static-api/eoldate.js";
import { generateStaticApi } from "../../tools/static-api/generate.js";

const nullableWhenUnrecorded = new Set([
  "releaseDate",
  "isLts",
  "ltsFrom",
  "isEoas",
  "eoasFrom",
  "isEol",
  "eolFrom",
  "isEoes",
  "eoesFrom",
  "isMaintained",
  "latest",
  "versionCommand",
  "links.icon",
  "links.releasePolicy",
]);

function assertShape(actual: unknown, recorded: unknown, path = ""): void {
  if (recorded === null) return; // Null recordings show a required key but do not establish its non-null type.
  if (nullableWhenUnrecorded.has(path.replace(/^releases\./, "")) && actual === null) return;
  if (Array.isArray(recorded)) {
    assert.ok(Array.isArray(actual), path);
    // The two sources can report different lengths, and Ebb can have no entries for a field.
    if (actual.length > 0 && recorded.length > 0) assertShape(actual[0], recorded[0], path);
    return;
  }
  assert.equal(typeof actual, typeof recorded, path);
  if (typeof recorded === "object") {
    assert.ok(actual !== null && !Array.isArray(actual), path);
    const object = actual as Record<string, unknown>;
    if (path === "custom" || path === "releases.custom") return; // Product-specific extension keys can differ.
    for (const [key, value] of Object.entries(recorded)) {
      const address = [path, key].filter(Boolean).join(".");
      assert.ok(Object.hasOwn(object, key), `missing ${address}`);
      assertShape(object[key], value, address);
    }
  }
}

test("the build emits the recorded v1 product shapes in a separate API tree", async (t) => {
  const work = await mkdtemp(join(tmpdir(), "ebb-eoldate-shape-"));
  t.after(() => rm(work, { recursive: true, force: true }));
  const outDir = join(work, "api/v1");
  const eolCompatOutDir = join(work, "api/eol-compat/v1");
  await generateStaticApi({ outDir, eolCompatOutDir });
  const products = JSON.parse(await readFile(join(eolCompatOutDir, "products.json"), "utf8"));
  const ids = await readEolDateIds(".");
  assert.deepEqual(
    products.result.map((product: { name: string }) => product.name),
    ids.map((item) => item.id),
  );
  const dotnet = JSON.parse(await readFile(join(eolCompatOutDir, "products/dotnet.json"), "utf8"));
  assert.ok(dotnet.result.releases.some((release: { name: string }) => release.name === "8"));
  for (const id of ["nodejs", "python"]) {
    const raw = JSON.parse(await readFile(join(eolCompatOutDir, "products", `${id}.json`), "utf8"));
    const recorded = JSON.parse(await readFile(join("tests/fixtures/eoldate", `${id}.json`), "utf8"));
    assert.ok(raw.result.releases.length > 0, id);
    assertShape({ ...raw, result: undefined }, { ...recorded, result: undefined });
    assertShape(raw.result, recorded.result);
    for (const release of raw.result.releases) assertShape(release, recorded.result.releases[0]);
    assert.ok(products.result.some((product: { name: string }) => product.name === id));
    await assert.rejects(readFile(join(outDir, "products", `${id}.json`)), { code: "ENOENT" });
  }
  await assert.rejects(readFile(join(eolCompatOutDir, "products/unknown.json")), { code: "ENOENT" });
});
