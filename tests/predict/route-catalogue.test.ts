import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bundledRouteIds, canonicalRuleUrl, unpackRuleRoutes, type PackedRoutes } from "../../src/site-routes.js";
import { packRuleRoutes, unpackSignedCatalogue } from "../../tools/site-data/pack-routes.js";
import { publicRuleRoutes } from "../../tools/site-data/public-rule-routes.js";

test("packed route dictionary preserves the entire previous signed catalogue and rejects unpublished IDs", async () => {
  const entireCatalogue = unpackSignedCatalogue(publicRuleRoutes);
  assert.equal(entireCatalogue.size, 782);
  const bundled = bundledRouteIds("registry");
  const packed = JSON.parse(await readFile("dist/src/public-rule-routes.json", "utf8")) as PackedRoutes;
  assert.deepEqual(unpackRuleRoutes(packed, bundled), entireCatalogue);
  for (const [id, slug] of entireCatalogue) {
    assert.equal(canonicalRuleUrl(id), `https://velella.sh/ebb/rules/${slug}/`);
  }
  for (const id of bundled.filter((id) => !entireCatalogue.has(id))) {
    assert.equal(canonicalRuleUrl(id), undefined);
  }
});

test("historical or updated-data IDs absent from this package retain exact signed routes and aliases", () => {
  const installed = ["current.rule", "current.unpublished"];
  const signed = new Map([
    ["current.rule", "current-rule"],
    ["old.rule", "former-locked-slug"],
    ["updated.rule", "updated-rule"],
  ]);
  const packed = packRuleRoutes(signed, installed);
  assert.deepEqual(unpackRuleRoutes(packed, installed), signed);
  assert.throws(() => unpackRuleRoutes(packed, [...installed, "unknown"]), /dictionary/);
});
