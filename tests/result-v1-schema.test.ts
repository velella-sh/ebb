import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

import { check } from "../src/check.js";
import type { Result } from "../src/result.js";

async function readSchema() {
  return JSON.parse(await readFile(resolve("schemas/result.v1.schema.json"), "utf8")) as {
    $schema?: string;
    $id?: string;
    title?: string;
  };
}

async function validator() {
  return new Ajv2020({ allErrors: true }).compile(await readSchema());
}

function sampleResult(): Result {
  return {
    status: "scheduled",
    matches: [
      {
        ruleId: "nodejs.runtime.eol-22",
        event: "scheduled",
        date: "2027-04-30",
        daysLeft: 394,
        replacement: "Node.js 24 LTS or later",
        sources: [
          {
            title: "Node.js Release Working Group schedule",
            url: "https://github.com/nodejs/Release/blob/main/schedule.json",
            accessedAt: "2026-10-24",
          },
        ],
        reviewedAt: "2026-10-24",
      },
    ],
    version: "22.11.0",
    asOf: "2026-04-01",
  };
}

test("result.v1.schema.json declares draft 2020-12, $id, and title", async () => {
  const schema = await readSchema();
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "https://github.com/velella-sh/ebb/schemas/result.v1.schema.json");
  assert.ok(typeof schema.title === "string" && schema.title.trim().length > 0);
});

test("a sample result and live check outputs match the schema", async () => {
  const validate = await validator();

  const sample = sampleResult();
  assert.equal(validate(sample), true, JSON.stringify(validate.errors));

  const withoutAsOf = check("pkg:npm/left-pad", "1.3.0");
  assert.equal(validate(withoutAsOf), true, JSON.stringify(validate.errors));

  const empty = check("pkg:generic/nodejs", "24.0.0", "2026-04-01");
  assert.equal(validate(empty), true, JSON.stringify(validate.errors));
});

test("the schema rejects unknown fields and invalid values", async () => {
  const validate = await validator();
  const mutations: Array<[string, (value: Record<string, unknown>) => void]> = [
    [
      "unknown top-level field",
      (value) => {
        value.extra = true;
      },
    ],
    [
      "unknown match field",
      (value) => {
        (value.matches as Array<Record<string, unknown>>)[0]!.extra = "nope";
      },
    ],
    [
      "unknown source field",
      (value) => {
        ((value.matches as Array<Record<string, unknown>>)[0]!.sources as Array<Record<string, unknown>>)[0]!.note =
          "nope";
      },
    ],
    [
      "unknown status value",
      (value) => {
        value.status = "supported";
      },
    ],
    [
      "match event set to ok",
      (value) => {
        (value.matches as Array<Record<string, unknown>>)[0]!.event = "ok";
      },
    ],
    [
      "ok status with non-empty matches",
      (value) => {
        value.status = "ok";
      },
    ],
    [
      "non-ok status with empty matches",
      (value) => {
        value.matches = [];
      },
    ],
    [
      "missing reviewedAt",
      (value) => {
        delete (value.matches as Array<Record<string, unknown>>)[0]!.reviewedAt;
      },
    ],
    [
      "empty sources",
      (value) => {
        (value.matches as Array<Record<string, unknown>>)[0]!.sources = [];
      },
    ],
    [
      "zero daysLeft",
      (value) => {
        (value.matches as Array<Record<string, unknown>>)[0]!.daysLeft = 0;
      },
    ],
    [
      "whitespace-only version",
      (value) => {
        value.version = "   ";
      },
    ],
  ];

  for (const [name, mutate] of mutations) {
    const value = structuredClone(sampleResult()) as unknown as Record<string, unknown>;
    mutate(value);
    assert.equal(validate(value), false, name);
  }
});
