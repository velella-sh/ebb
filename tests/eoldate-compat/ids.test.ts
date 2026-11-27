import assert from "node:assert/strict";
import test from "node:test";

import { purlIdentity } from "../../src/purl.js";
import { isIsoDate } from "../../src/registry.js";
import { readEolDateIds } from "../../tools/static-api/eoldate.js";

test("the endoflife.date allowlist contains only product identities and index provenance", async () => {
  const ids = await readEolDateIds(".");
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids.map((item) => item.id)).size, ids.length);
  assert.equal(new Set(ids.map((item) => item.purl)).size, ids.length);
  for (const item of ids) {
    assert.deepEqual(Object.keys(item).sort(), ["id", "purl", "source"]);
    assert.deepEqual(Object.keys(item.source).sort(), ["date", "url"]);
    assert.equal(item.source.url, "https://endoflife.date/api/v1/products/");
    assert.ok(isIsoDate(item.source.date));
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(purlIdentity(item.purl), item.purl);
  }
});
