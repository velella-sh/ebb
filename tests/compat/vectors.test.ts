import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { type CompatibilityTable, createCompatibilityReader } from "../../src/compat.js";

interface Vector {
  section: string;
  subject: string;
  version?: string;
  runtime: string;
  runtimeVersion: string;
  status: "supported" | "not-supported" | "unknown";
  kind?: "documented" | "declared";
}

test("compatibility format conformance vectors", async () => {
  const data = JSON.parse(await readFile("conformance/vectors/compat.json", "utf8")) as {
    format: string;
    tables: CompatibilityTable[];
    supports: (Vector & { version: string })[];
    firstSupporting: Vector[];
  };
  assert.equal(data.format, "https://velella.sh/ebb/formats/compat.v1/");
  const reader = createCompatibilityReader(data.tables);
  for (const vector of data.supports) {
    assert.match(vector.section, /^#(?:table-and-rows|query-results)$/);
    const answer = reader.supports(vector.subject, vector.version, vector.runtime, vector.runtimeVersion);
    assert.equal(answer.status, vector.status, JSON.stringify(vector));
    assert.equal("row" in answer ? answer.row.kind : undefined, vector.kind, JSON.stringify(vector));
    if ("row" in answer) assert.match(answer.row.source.url, /^https:\/\//);
  }
  for (const vector of data.firstSupporting) {
    assert.equal(vector.section, "#query-results");
    const answer = reader.firstSupporting(vector.subject, vector.runtime, vector.runtimeVersion);
    assert.equal(answer.status, vector.status, JSON.stringify(vector));
    assert.equal("version" in answer ? answer.version : undefined, vector.version, JSON.stringify(vector));
  }
  assert.equal(reader.requirementsOf("pkg:maven/org.example/build-tool", "1.0.0")[0]?.requires.length, 2);
});
