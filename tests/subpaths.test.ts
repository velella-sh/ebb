import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";
import { BUNDLED_ECOSYSTEMS } from "../src/data-bundle.js";
import { createEbb } from "../src/create.js";
import { check, checkAll, replacementFor, rulesFor } from "../src/index.js";
import type { RegistryV2Rule } from "../src/registry.js";

test("every ecosystem subpath exports its rules, ecosystem name, and data document", async () => {
  assert.equal(BUNDLED_ECOSYSTEMS.length, 25);

  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const mod = await import(`../src/data/ecosystems/${ecosystem}.js`);
    assert.equal(mod.ecosystem, ecosystem);
    assert.ok(Array.isArray(mod.rules), `rules should be an array for ${ecosystem}`);
    assert.ok(mod.rules.length > 0, `expected at least 1 rule for ${ecosystem}`);
    assert.equal(mod.default, mod.rules, `default export should be rules for ${ecosystem}`);
    assert.equal(mod.data.ecosystem, ecosystem);
    assert.equal(mod.data.schemaVersion, "ebb.registry.v2");

    // Every rule in this module must declare this ecosystem
    for (const rule of mod.rules as readonly RegistryV2Rule[]) {
      assert.equal(
        rule.ecosystem,
        ecosystem,
        `rule ${rule.id} declared ecosystem ${rule.ecosystem}, expected ${ecosystem}`,
      );
    }
  }
});

test("createEbb factory creates isolated instance loading only requested ecosystems by name", async () => {
  const npmEbb = createEbb({ ecosystems: ["npm"] });
  assert.deepEqual(npmEbb.loadedEcosystems, ["npm"]);

  // Checks npm package
  const npmRes = npmEbb.check("pkg:npm/request", "2.88.2");
  assert.equal(npmRes.status, "deprecated");
  assert.ok(npmRes.matches.length > 0);

  // Python package is not loaded in this instance -> status: ok
  const pyRes = npmEbb.check("pkg:pypi/requests", "2.28.0");
  assert.equal(pyRes.status, "ok");
  assert.equal(pyRes.matches.length, 0);

  // rulesFor on npm package vs python package
  assert.ok(npmEbb.rulesFor("pkg:npm/request").length > 0);
  assert.equal(npmEbb.rulesFor("pkg:pypi/requests").length, 0);

  // replacementFor
  assert.equal(npmEbb.replacementFor("pkg:npm/node-sass", "9.0.0"), "pkg:npm/sass");
  assert.equal(npmEbb.replacementFor("pkg:pypi/some-pkg", "1.0.0"), null);

  // checkAll batch
  const batch = npmEbb.checkAll([
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:pypi/requests", version: "2.28.0" },
  ]);
  assert.equal(batch.summary.total, 2);
  assert.equal(batch.summary.byStatus.deprecated, 1);
  assert.equal(batch.summary.byStatus.ok, 1);
});

test("createEbb accepts imported data modules directly", async () => {
  const npmMod = await import("../src/data/ecosystems/npm.js");
  const pyMod = await import("../src/data/ecosystems/python.js");

  const multiEbb = createEbb({ ecosystems: [npmMod, pyMod.rules] });
  assert.deepEqual(multiEbb.loadedEcosystems, ["npm", "python"]);

  assert.equal(multiEbb.check("pkg:npm/request", "2.88.2").status, "deprecated");
  assert.equal(multiEbb.check("pkg:pypi/argparse", "1.4.0").status, "end-of-life");

  // Rust / cargo is NOT included
  assert.equal(multiEbb.check("pkg:cargo/rand", "0.3.0").status, "ok");
});

test("root exports continue loading all data", () => {
  assert.equal(check("pkg:npm/request", "2.88.2").status, "deprecated");
  assert.equal(check("pkg:pypi/argparse", "1.4.0").status, "end-of-life");
  assert.ok(rulesFor("pkg:npm/request").length > 0);
  assert.ok(rulesFor("pkg:pypi/argparse").length > 0);
  assert.equal(replacementFor("pkg:npm/node-sass", "9.0.0"), "pkg:npm/sass");

  const allBatch = checkAll([
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:pypi/argparse", version: "1.4.0" },
  ]);
  assert.equal(allBatch.summary.total, 2);
  assert.equal(allBatch.summary.byStatus.deprecated, 1);
  assert.equal(allBatch.summary.byStatus["end-of-life"], 1);
});

test("esbuild tree-shaking bundles only the requested ecosystem data module", async () => {
  // Bundle a script that only imports @velella/ebb/data/npm
  const testEntry = `
import npmRules from "./dist/src/data/ecosystems/npm.js";
console.log(npmRules.length);
`;

  const buildResult = await esbuild.build({
    stdin: {
      contents: testEntry,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    write: false,
    minify: false,
    treeShaking: true,
  });

  const bundledCode = buildResult.outputFiles[0]!.text;

  // The bundle must contain npm identifiers
  assert.ok(
    bundledCode.includes("npm.package.request.deprecated") || bundledCode.includes("pkg:npm/"),
    "bundle should include npm rules",
  );

  // The bundle must NOT contain rules from other ecosystems!
  assert.ok(!bundledCode.includes("terraform.provider.aws.v3"), "bundle should tree-shake away terraform rules");
  assert.ok(!bundledCode.includes("dart.sdk.end-of-support"), "bundle should tree-shake away dart rules");
  assert.ok(!bundledCode.includes("elixir.otp.eol"), "bundle should tree-shake away elixir rules");

  // Bundle size for single ecosystem is compact
  const bundleBytes = Buffer.byteLength(bundledCode, "utf8");
  assert.ok(bundleBytes < 300_000, `expected npm bundle < 300 KB, got ${bundleBytes}`);
});

test("measures bundle size per ecosystem", async () => {
  const table: Array<{ ecosystem: string; rules: number; rawBytes: number; gzipBytes: number }> = [];

  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const mod = await import(`../src/data/ecosystems/${ecosystem}.js`);
    const raw = JSON.stringify(mod.rules);
    const rawBytes = Buffer.byteLength(raw, "utf8");
    const gzipBytes = gzipSync(raw).length;
    table.push({
      ecosystem,
      rules: mod.rules.length,
      rawBytes,
      gzipBytes,
    });
  }

  // Ensure table covers all 25 ecosystems
  assert.equal(table.length, 25);
  for (const row of table) {
    assert.ok(row.rules > 0);
    assert.ok(row.rawBytes > 0);
    assert.ok(row.gzipBytes > 0);
    assert.ok(row.gzipBytes < row.rawBytes, "gzip should compress data");
  }
});
