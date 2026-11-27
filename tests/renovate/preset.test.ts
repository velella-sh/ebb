import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("renovate/eol.json defines valid preset structure", async () => {
  const presetPath = join(process.cwd(), "renovate/eol.json");
  const content = await readFile(presetPath, "utf8");
  const parsed = JSON.parse(content) as {
    customDatasources?: Record<string, { defaultRegistryUrlTemplate: string; format: string }>;
    packageRules?: Array<{
      matchPackageNames?: string[];
      overrideDatasource?: string;
      overridePackageName?: string;
      versioning?: string;
    }>;
  };

  assert.ok(parsed.customDatasources?.ebb, "Preset must configure customDatasources.ebb");
  assert.equal(parsed.customDatasources.ebb.format, "json");
  assert.ok(parsed.customDatasources.ebb.defaultRegistryUrlTemplate.includes("{{packageName}}"));

  assert.ok(Array.isArray(parsed.packageRules), "Preset must define packageRules");
  assert.ok(parsed.packageRules.length >= 4, "Must cover Node.js, Python, Go and base images");

  const nodeRule = parsed.packageRules.find((r) => r.overridePackageName === "generic/nodejs");
  assert.ok(nodeRule, "Must have packageRule for generic/nodejs");
  assert.equal(nodeRule.overrideDatasource, "custom.ebb");

  const pythonRule = parsed.packageRules.find((r) => r.overridePackageName === "generic/python");
  assert.ok(pythonRule, "Must have packageRule for generic/python");
  assert.equal(pythonRule.overrideDatasource, "custom.ebb");

  const goRule = parsed.packageRules.find((r) => r.overridePackageName === "generic/golang");
  assert.ok(goRule, "Must have packageRule for generic/golang");
  assert.equal(goRule.overrideDatasource, "custom.ebb");
});
