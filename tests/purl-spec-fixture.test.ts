import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const fixtureRoot = fileURLToPath(new URL("../../tests/fixtures/purl/", import.meta.url));

test("vendors the official purl-spec suite with its license", async () => {
  const license = await readFile(join(fixtureRoot, "LICENSE"), "utf8");
  assert.match(license, /SPDX-License-Identifier:\s*MIT/);
  assert.match(license, /Copyright \(c\) the purl authors/);

  const spec = JSON.parse(await readFile(join(fixtureRoot, "spec/specification-test.json"), "utf8")) as {
    $schema?: string;
    tests?: unknown[];
  };
  assert.equal(spec.$schema, "https://packageurl.org/schemas/purl-test.schema-0.2.json");
  assert.ok(Array.isArray(spec.tests) && spec.tests.length > 0);

  const typeFiles = (await readdir(join(fixtureRoot, "types"))).filter((name) => name.endsWith("-test.json")).sort();
  assert.ok(typeFiles.length > 0);
  for (const name of typeFiles) {
    const suite = JSON.parse(await readFile(join(fixtureRoot, "types", name), "utf8")) as {
      $schema?: string;
      tests?: unknown[];
    };
    assert.equal(suite.$schema, "https://packageurl.org/schemas/purl-test.schema-0.2.json", name);
    assert.ok(Array.isArray(suite.tests) && suite.tests.length > 0, name);
  }
});
