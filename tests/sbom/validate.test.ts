import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Ajv } from "ajv";

import { enrichSbom } from "../../src/sbom/index.js";

function json(path: string): object {
  return JSON.parse(readFileSync(path, "utf8"));
}

for (const version of ["1.6", "1.7"]) {
  test(`enriched CycloneDX ${version} generator output validates against the official schema offline`, () => {
    const base = "schemas/vendor/cyclonedx-";
    const references = ["spdx.schema.json", "jsf-0.82.schema.json"];
    if (version === "1.7") references.push("cryptography-defs.schema.json");
    const ajv = new Ajv({ strict: false, validateFormats: false });
    for (const ref of references) ajv.addSchema(json(`${base}${version}/${ref}`));
    const validate = ajv.compile(json(`${base}${version}.schema.json`));
    const input = json(`tests/fixtures/sbom/cyclonedx-${version}.json`);
    assert.ok(validate(input), JSON.stringify(validate.errors));
    const { document, summary } = enrichSbom(input, "cyclonedx");
    assert.ok(summary.enriched >= 2);
    assert.ok(validate(document), JSON.stringify(validate.errors));
    const text = JSON.stringify(document);
    assert.match(text, /cdx:lifecycle:milestone:endOfLife/);
    assert.match(text, /npm\.package\.vue/);
    assert.deepEqual(enrichSbom(document).document, document);
  });
}
