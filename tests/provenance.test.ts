import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { registryV2Issues, type RegistryV2Rule } from "../src/registry.js";
import { sourcesOf } from "../src/sources-of.js";
import { formatSourcesText, formatSourcesMarkdown } from "../src/cli/format/sources.js";

test("schemas/rule.v2.schema.json validates an individual v2 rule", async () => {
  const schema = JSON.parse(await readFile(resolve("schemas/rule.v2.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true });
  const regSchema = JSON.parse(await readFile(resolve("schemas/registry.v2.schema.json"), "utf8"));
  ajv.addSchema(regSchema, "registry.v2.schema.json");
  const validate = ajv.compile(schema);

  const validRule = {
    id: "npm.package.test.deprecated",
    ecosystem: "npm",
    purl: "pkg:npm/test",
    vers: "vers:npm/*",
    event: "deprecated",
    title: "test is deprecated",
    summary: "Package deprecated.",
    severity: "high",
    sources: [
      {
        title: "Test source",
        url: "https://example.com/test",
        accessedAt: "2026-10-13",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-10-13",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  };

  assert.equal(validate(validRule), true, JSON.stringify(validate.errors));

  // Rejects missing method
  const missingMethod = structuredClone(validRule);
  delete (missingMethod.provenance as Record<string, unknown>).method;
  assert.equal(validate(missingMethod), false);

  // Rejects invalid method
  const invalidMethod = structuredClone(validRule);
  (invalidMethod.provenance as Record<string, unknown>).method = "unknown";
  assert.equal(validate(invalidMethod), false);

  // Accepts imported with importer and importerVersion
  const importedRule = structuredClone(validRule);
  importedRule.provenance.method = "imported";
  (importedRule.provenance as Record<string, unknown>).importer = "test-importer";
  (importedRule.provenance as Record<string, unknown>).importerVersion = "1.0.0";
  assert.equal(validate(importedRule), true);

  // Rejects empty reviewers
  const emptyReviewers = structuredClone(validRule);
  (emptyReviewers.provenance as Record<string, unknown>).reviewers = [];
  assert.equal(validate(emptyReviewers), false);
});

test("registryV2Issues enforces method and reviewers structure", () => {
  const baseRule: RegistryV2Rule = {
    id: "npm.package.test.deprecated",
    ecosystem: "npm",
    purl: "pkg:npm/test",
    vers: "vers:npm/*",
    event: "deprecated",
    title: "test is deprecated",
    summary: "Package deprecated.",
    severity: "high",
    sources: [
      {
        title: "Test source",
        url: "https://example.com/test",
        accessedAt: "2026-10-13",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-10-13",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  };

  const reg = {
    schemaVersion: "ebb.registry.v2",
    ecosystem: "npm",
    rules: [baseRule],
  };

  assert.deepEqual(registryV2Issues(reg), []);

  // Missing method
  const noMethodReg = structuredClone(reg);
  delete (noMethodReg.rules[0]!.provenance as unknown as Record<string, unknown>).method;
  assert.ok(registryV2Issues(noMethodReg).some((msg) => msg.includes("provenance.method is required")));

  // Invalid method
  const badMethodReg = structuredClone(reg);
  (badMethodReg.rules[0]!.provenance as unknown as Record<string, unknown>).method = "generated";
  assert.ok(registryV2Issues(badMethodReg).some((msg) => msg.includes("provenance.method must be one of")));

  // Empty reviewers
  const badReviewersReg = structuredClone(reg);
  (badReviewersReg.rules[0]!.provenance as unknown as Record<string, unknown>).reviewers = [];
  assert.ok(
    registryV2Issues(badReviewersReg).some((msg) => msg.includes("provenance.reviewers must be a non-empty list")),
  );
});

test("sourcesOf and formatting expose provenance details", () => {
  const testRule: RegistryV2Rule = {
    id: "npm.package.test.deprecated",
    ecosystem: "npm",
    purl: "pkg:npm/test",
    vers: "vers:npm/*",
    event: "deprecated",
    title: "test is deprecated",
    summary: "Package deprecated.",
    severity: "high",
    sources: [
      {
        title: "Test source",
        url: "https://example.com/test",
        accessedAt: "2026-10-13",
      },
    ],
    provenance: {
      observedAt: "2026-10-13",
      reviewedAt: "2026-10-14",
      reviewer: "arminazimi",
      reviewers: ["arminazimi", "second-reviewer"],
      method: "imported",
      importer: "test-bot",
      importerVersion: "2.1.0",
    },
  };

  const res = sourcesOf("npm.package.test.deprecated", { rules: [testRule] });
  assert.equal(res.method, "imported");
  assert.deepEqual(res.reviewers, ["arminazimi", "second-reviewer"]);
  assert.equal(res.importer, "test-bot");
  assert.equal(res.importerVersion, "2.1.0");

  const text = formatSourcesText(res);
  assert.ok(text.includes("Method: imported"));
  assert.ok(text.includes("arminazimi, second-reviewer"));
  assert.ok(text.includes("Importer: test-bot (2.1.0)"));

  const md = formatSourcesMarkdown(res);
  assert.ok(md.includes("- **Method:** `imported`"));
  assert.ok(md.includes("arminazimi, second-reviewer"));
  assert.ok(md.includes("- **Importer:** `test-bot` (`2.1.0`)"));
});
