import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

/**
 * Every source subpath exported from the 0.1.0 tarball (`dist/src/<subpath>.js` via `./*`).
 * Keep these resolving alongside the `"."` root entry until 1.0.
 */
const LEGACY_0_1_0_SUBPATHS = [
  "as-of",
  "bundled-rules",
  "cache-paths",
  "check",
  "countdown",
  "data-bundle",
  "data-release-log",
  "data-signature",
  "data-source",
  "data-status",
  "data-update",
  "domain",
  "errors",
  "export/cle",
  "forecast",
  "lookup",
  "min-support",
  "package-files",
  "product-name",
  "purl",
  "registry",
  "required",
  "result",
  "rule-guards",
  "rule-lint",
  "rule-versions",
  "vers",
  "vers/gem",
  "vers/index",
  "vers/maven",
  "vers/nuget",
  "vers/pep440",
  "vers/semver",
  "version",
] as const;

test("every 0.1.0 subpath export resolves and loads via @velella/ebb/*", async () => {
  const loaded = new Map<string, Record<string, unknown>>();
  for (const subpath of LEGACY_0_1_0_SUBPATHS) {
    const module = (await import(`@velella/ebb/${subpath}`)) as Record<string, unknown>;
    assert.equal(typeof module, "object", `expected object namespace for ${subpath}`);
    assert.notEqual(module, null, `expected non-null module for ${subpath}`);
    loaded.set(subpath, module);
  }

  assert.equal(typeof loaded.get("check")?.check, "function");
  assert.equal(typeof loaded.get("lookup")?.lookupProduct, "function");
  assert.equal(typeof loaded.get("bundled-rules")?.bundledRules, "function");
  assert.equal(typeof loaded.get("purl")?.parsePurl, "function");
  assert.equal(typeof loaded.get("vers")?.versContains, "function");
  assert.equal(typeof loaded.get("vers/index")?.versContains, "function");
  assert.equal(typeof loaded.get("export/cle")?.exportCle, "function");
  assert.equal(typeof loaded.get("as-of")?.applyAsOf, "function");
  assert.equal(typeof loaded.get("forecast")?.buildForecast, "function");
  assert.equal(typeof loaded.get("min-support")?.applyMinSupport, "function");
  assert.equal(typeof loaded.get("data-status")?.getDataStatus, "function");
  assert.equal(typeof loaded.get("version")?.VERSION, "string");
});

test("legacy ./package.json subpath and root entry both resolve", async () => {
  const root = await import("@velella/ebb");
  assert.equal(typeof root.check, "function");

  const pkgSpecifier = "@velella/ebb/package.json";
  const pkg = (await import(pkgSpecifier, { with: { type: "json" } })) as {
    default: { name: string };
  };
  assert.equal(pkg.default.name, "@velella/ebb");

  const require = createRequire(import.meta.url);
  assert.ok(require.resolve(pkgSpecifier).endsWith("package.json"));
});
