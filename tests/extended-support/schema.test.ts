import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { validateRegistryV2 } from "../../src/registry.js";

test("schemas/rule.v2.schema.json accepts end-of-extended-support event", async () => {
  const schema = JSON.parse(await readFile(resolve("schemas/rule.v2.schema.json"), "utf8"));
  const regSchema = JSON.parse(await readFile(resolve("schemas/registry.v2.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(regSchema, "registry.v2.schema.json");
  const validate = ajv.compile(schema);

  const baseRule = {
    id: "container.ubuntu.extended-support-20.04",
    ecosystem: "container",
    purl: "pkg:docker/library/ubuntu",
    vers: "vers:semver/>=20.0.0|<20.10.0",
    event: "end-of-extended-support",
    title: "Ubuntu 20.04 LTS extended support ends on 2035-05-31",
    summary: "Ubuntu Pro with Legacy add-on provides security maintenance through 2035-05-31.",
    severity: "medium",
    deadline: "2035-05-31",
    sources: [
      {
        title: "Ubuntu release cycle",
        url: "https://ubuntu.com/about/release-cycle",
        accessedAt: "2026-11-27",
      },
    ],
    provenance: {
      observedAt: "2026-11-27",
      reviewedAt: "2026-11-27",
      reviewer: "arminazimi",
      reviewers: ["arminazimi"],
      method: "manual",
    },
  };

  assert.equal(validate(baseRule), true, "end-of-extended-support rule should validate against json schema");

  const validRegistry = {
    schemaVersion: "ebb.registry.v2",
    ecosystem: "container",
    rules: [baseRule],
  };
  assert.doesNotThrow(() => validateRegistryV2(validRegistry), "validateRegistryV2 accepts end-of-extended-support");

  const invalidRule = {
    ...baseRule,
    event: "unknown-support-event",
  };

  assert.equal(validate(invalidRule), false, "unknown event must fail json schema validation");

  const invalidRegistry = {
    schemaVersion: "ebb.registry.v2",
    ecosystem: "container",
    rules: [invalidRule],
  };
  assert.throws(
    () => validateRegistryV2(invalidRegistry),
    /event must be one of/,
    "validateRegistryV2 rejects unknown event",
  );
});
