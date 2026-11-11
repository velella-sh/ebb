import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

interface ResultSchema {
  properties: Record<string, unknown>;
  $defs: {
    match: { properties: Record<string, unknown> };
    source: { properties: Record<string, unknown> };
  };
}

function sectionBody(markdown: string, parentHeading: string, fieldHeading: string): string {
  const lines = markdown.split(/\r?\n/);
  const parentIndex = lines.findIndex((line) => line.trim() === parentHeading);
  assert.ok(parentIndex !== -1, `docs/result-model.md is missing parent heading ${parentHeading}`);

  let parentEnd = lines.length;
  for (let index = parentIndex + 1; index < lines.length; index += 1) {
    if (/^##\s/.test(lines[index] ?? "")) {
      parentEnd = index;
      break;
    }
  }

  const fieldIndex = lines.slice(parentIndex + 1, parentEnd).findIndex((line) => line.trim() === fieldHeading);
  assert.ok(fieldIndex !== -1, `docs/result-model.md is missing ${fieldHeading} under ${parentHeading}`);

  const start = parentIndex + 1 + fieldIndex + 1;
  let end = parentEnd;
  for (let index = start; index < parentEnd; index += 1) {
    if (/^###\s/.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function extractFirstJsonExample(body: string, label: string): unknown {
  const match = body.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(match !== null, `${label} must include a fenced json example`);
  return JSON.parse(match[1]!);
}

test("every field in result.v1.schema.json has a docs section with a valid JSON example", async () => {
  const [schemaRaw, markdown] = await Promise.all([
    readFile(resolve("schemas/result.v1.schema.json"), "utf8"),
    readFile(resolve("docs/result-model.md"), "utf8"),
  ]);
  const schema = JSON.parse(schemaRaw) as ResultSchema;

  const groups = [
    {
      parent: "## Field reference: `Result`",
      fields: Object.keys(schema.properties),
      experimental: new Set(["asOf"]),
      hasTag: true,
    },
    {
      parent: "## Field reference: `ResultMatch`",
      fields: Object.keys(schema.$defs.match.properties),
      experimental: new Set(["daysLeft"]),
      hasTag: true,
    },
    {
      parent: "## Field reference: `EvidenceSource`",
      fields: Object.keys(schema.$defs.source.properties),
      experimental: new Set<string>(),
      hasTag: false,
    },
  ] as const;

  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  const examplesStart = markdown.indexOf("## Complete examples");
  const examplesEnd = markdown.indexOf("## Field reference:");
  assert.ok(examplesStart !== -1 && examplesEnd > examplesStart, "missing Complete examples section");
  const completeBlocks = [...markdown.slice(examplesStart, examplesEnd).matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)];
  assert.ok(completeBlocks.length >= 2, "expected at least two complete JSON examples");
  for (const block of completeBlocks) {
    const parsed = JSON.parse(block[1]!) as unknown;
    assert.equal(validate(parsed), true, `complete doc example failed schema: ${JSON.stringify(validate.errors)}`);
  }

  for (const group of groups) {
    for (const field of group.fields) {
      const body = sectionBody(markdown, group.parent, `### \`${field}\``);
      const parsed = extractFirstJsonExample(body, `${group.parent} -> ${field}`);
      assert.notEqual(parsed, undefined, `${field} example must parse as JSON`);
      if (group.hasTag) {
        const expectedTag = group.experimental.has(field) ? "@experimental" : "@stable";
        assert.ok(body.includes(expectedTag), `${group.parent} -> ${field} must state ${expectedTag}`);
      }
    }
  }
});
