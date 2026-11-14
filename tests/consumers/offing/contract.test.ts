import assert from "node:assert/strict";
import test from "node:test";
import * as ebbBrowser from "../../../src/browser.js";
import { bundledRules } from "../../../src/bundled-rules.js";
import { createEbb } from "../../../src/create.js";
import { ecosystems } from "../../../src/data/ecosystems/index.js";
import npmModule from "../../../src/data/ecosystems/npm.js";
import pythonModule from "../../../src/data/ecosystems/python.js";
import { getOffingHint, isHintSilenced } from "../../../src/hint.js";
import { check, checkAll, replacementFor, rulesFor } from "../../../src/index.js";
import { parsePurl } from "../../../src/purl.js";
import { DataSignatureError, verifyArtifactSignature, verifyDataBundle } from "../../../src/verify.js";

test("offing contract: check returns schemaVersion 1 with expected fields", () => {
  const result = check("pkg:npm/left-pad", "1.3.0");
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, "deprecated");
  assert.equal(result.version, "1.3.0");
  assert.ok(Array.isArray(result.matches));
  assert.ok(result.matches.length > 0);

  const match = result.matches[0];
  assert.ok(match);
  assert.equal(typeof match.ruleId, "string");
  assert.equal(typeof match.event, "string");
  assert.ok(Array.isArray(match.sources));
  assert.ok(match.sources.length > 0);
  assert.equal(typeof match.sources[0]?.url, "string");
});

test("offing contract: check handles clean components", () => {
  const result = check("pkg:generic/nodejs", "24.0.0");
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.matches, []);
});

test("offing contract: checkAll returns batch results and summary", () => {
  const batch = [
    { purl: "pkg:npm/left-pad", version: "1.3.0" },
    { purl: "pkg:generic/nodejs", version: "24.0.0" },
    { purl: "node", version: "18.20.4" },
  ];

  const response = checkAll(batch);
  assert.equal(response.results.length, 3);
  assert.equal(response.summary.total, 3);
  assert.equal(response.summary.errors, 0);
  assert.equal(response.summary.byStatus.deprecated, 1);
  assert.equal(response.summary.byStatus["end-of-life"], 1);
  assert.equal(response.summary.byStatus.ok, 1);
});

test("offing contract: replacementFor returns string or null", () => {
  const replacement = replacementFor("pkg:npm/left-pad", "1.3.0");
  assert.equal(typeof replacement, "string");
  assert.ok(replacement?.includes("padStart"));

  const noReplacement = replacementFor("pkg:npm/unknown-package-xyz", "1.0.0");
  assert.equal(noReplacement, null);
});

test("offing contract: rulesFor returns list of rules for a component", () => {
  const rules = rulesFor("pkg:npm/left-pad");
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 1);
  assert.ok(rules[0]?.id.includes("left-pad"));
  assert.equal(rules[0]?.purl, "pkg:npm/left-pad");
});

test("offing contract: parsePurl canonicalizes component identifiers", () => {
  const parsed = parsePurl("pkg:npm/%40babel/core@7.0.0");
  assert.equal(parsed.type, "npm");
  assert.equal(parsed.namespace, "@babel");
  assert.equal(parsed.name, "core");
  assert.equal(parsed.version, "7.0.0");
});

test("offing contract: bundledRules returns all built-in rules", async () => {
  const rules = await bundledRules();
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 300);
});

test("offing contract: browser and edge entry points execute identical check and checkAll logic", () => {
  const nodeResult = check("pkg:npm/left-pad", "1.3.0");
  const browserResult = ebbBrowser.check("pkg:npm/left-pad", "1.3.0");
  assert.deepEqual(browserResult, nodeResult);

  const batch = [
    { purl: "pkg:npm/left-pad", version: "1.3.0" },
    { purl: "pkg:npm/request", version: "2.88.2" },
  ];
  const nodeBatch = checkAll(batch);
  const browserBatch = ebbBrowser.checkAll(batch);
  assert.deepEqual(browserBatch, nodeBatch);

  const nodeReplacement = replacementFor("pkg:npm/left-pad", "1.3.0");
  const browserReplacement = ebbBrowser.replacementFor("pkg:npm/left-pad", "1.3.0");
  assert.equal(browserReplacement, nodeReplacement);
});

test("offing contract: ecosystem subpaths support modular loading with createEbb", () => {
  const scoped = createEbb({ ecosystems: [npmModule, pythonModule] });

  // NPM package evaluated
  const npmRes = scoped.check("pkg:npm/left-pad", "1.3.0");
  assert.equal(npmRes.status, "deprecated");

  // Python package evaluated
  const pyRes = scoped.check("pkg:pypi/pep8", "1.7.1");
  assert.equal(pyRes.status, "deprecated");

  // Cargo package not loaded in this scoped instance => returns ok
  const cargoRes = scoped.check("pkg:cargo/failure", "0.1.8");
  assert.equal(cargoRes.status, "ok");
  assert.equal(cargoRes.matches.length, 0);
});

test("offing contract: verify entry point operates without Sigstore dependencies", () => {
  // Built-in verification operates purely via node:crypto
  assert.equal(typeof verifyArtifactSignature, "function");
  assert.equal(typeof verifyDataBundle, "function");
  assert.equal(typeof DataSignatureError, "function");

  assert.throws(() => verifyArtifactSignature(new Uint8Array([1, 2, 3]), "invalid-signature-json"), DataSignatureError);
});

test("offing contract: all 25 ecosystem datasets load rules adhering to schemaVersion 1", () => {
  const ecosystemKeys = Object.keys(ecosystems);
  assert.ok(ecosystemKeys.length >= 25, `Expected at least 25 ecosystems, found ${ecosystemKeys.length}`);

  for (const [key, eco] of Object.entries(ecosystems)) {
    assert.ok(Array.isArray(eco.rules), `Ecosystem ${key} missing rules array`);
    assert.ok(eco.data, `Ecosystem ${key} missing data object`);
    assert.equal(eco.data.schemaVersion, "ebb.registry.v2", `Ecosystem ${key} registry schemaVersion mismatch`);

    // Verify rules have expected fields
    for (const rule of eco.rules.slice(0, 3)) {
      assert.ok(typeof rule.id === "string" && rule.id.length > 0);
      assert.ok(typeof rule.purl === "string" && rule.purl.length > 0);
    }
  }
});

test("offing contract: remediation hints point to Offing and can be silenced", () => {
  const hint = getOffingHint("deprecated");
  assert.ok(hint);
  const hintUrl = new URL(hint);
  assert.equal(hintUrl.protocol, "https:");
  assert.equal(hintUrl.host, "github.com");
  assert.ok(hintUrl.pathname === "/velella-sh/offing" || hintUrl.pathname === "/velella-sh/offing/");

  const noHintForOk = getOffingHint("ok");
  assert.equal(noHintForOk, null);

  const silenced = getOffingHint("deprecated", { noHint: true });
  assert.equal(silenced, null);

  assert.equal(isHintSilenced({ noHint: true }), true);
  assert.equal(isHintSilenced({ noHint: false }), false);
});
