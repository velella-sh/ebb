import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { CompatibilityTable } from "../../src/compat.js";
import { parsePurl, purlIdentity } from "../../src/purl.js";
import { isIsoDate, SCHEMES_BY_PURL_TYPE } from "../../src/registry.js";
import { parseVers, validateVersVersions, type VersionScheme, versionScheme } from "../../src/vers.js";

test("all compatibility tables validate, with canonical PURLs and appropriate VERS schemes", async () => {
  const schema = JSON.parse(await readFile("schemas/compat.v1.schema.json", "utf8"));
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(schema);
  const dir = "registry/tables";
  const names = (await readdir(dir)).filter((name) => name.endsWith(".compat.json")).sort();
  assert.ok(names.includes("runtime-support.compat.json"));

  const schemes = new Map<string, VersionScheme>();
  for (const name of names) {
    const table = JSON.parse(await readFile(`${dir}/${name}`, "utf8")) as CompatibilityTable;
    assert.ok(validate(table), `${name}: ${ajv.errorsText(validate.errors)}`);
    const first = table.rows[0];
    if (first) {
      const { source: _source, ...evidenceLess } = first;
      assert.equal(validate({ ...table, rows: [evidenceLess] }), false, "a row without a source must fail");
    }
    for (const row of table.rows) {
      assert.ok(isIsoDate(row.source.accessedAt), `${name}: invalid evidence date`);
      const source = new URL(row.source.url);
      assert.ok(source.hostname && !source.username && !source.password, `${name}: invalid source URL`);
      const ranges = [{ purl: row.subject, vers: row.subjectVers }, ...row.requires];
      for (const { purl, vers } of ranges) {
        const parsed = parsePurl(purl);
        assert.equal(purlIdentity(parsed), purl);
        const range = parseVers(vers);
        const allowed = SCHEMES_BY_PURL_TYPE[parsed.type];
        assert.ok(!allowed || allowed.includes(range.scheme), `${purl} cannot use ${range.scheme}`);
        validateVersVersions(range);
        // A single comparator per PURL keeps firstSupporting's ordering unambiguous across tables.
        const scheme = versionScheme(range.scheme);
        assert.equal(schemes.get(purl) ?? scheme, scheme, `${purl} uses incompatible schemes`);
        schemes.set(purl, scheme);
      }
    }
  }
});
