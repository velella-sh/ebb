import assert from "node:assert/strict";
import { test } from "node:test";

import { lookupProduct } from "../src/lookup.js";

test("lookup resolves a product purl with a mixed-case qualifier key", async () => {
  const canonical = await lookupProduct("pkg:npm/request", "2.88.2");
  const mixed = await lookupProduct("pkg:npm/request?Arch=x64", "2.88.2");

  assert.equal(mixed.product.purl, canonical.product.purl);
  assert.equal(mixed.product.id, canonical.product.id);
  assert.equal(mixed.status, canonical.status);
  assert.ok(mixed.findings.length > 0, "expected lifecycle findings for request@2.88.2");
});

test("lookup rejects a purl that is not a package URL", async () => {
  await assert.rejects(() => lookupProduct("pkg:"), /Invalid package URL/);
});
