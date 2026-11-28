import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { type EolPrediction, predictEol, type PredictionTable } from "../../src/predict.js";

test("public prediction reader passes the documented conformance vectors", (t) => {
  const fixture = JSON.parse(fs.readFileSync("conformance/vectors/predict.json", "utf8")) as {
    table: PredictionTable;
    vectors: Array<{ purl: string; version: string; spec: string; expected: EolPrediction | null }>;
  };
  const read = fs.readFileSync;
  t.mock.method(fs, "readFileSync", (path: Parameters<typeof fs.readFileSync>[0], options?: unknown) => {
    if (typeof path === "string" && /[/\\]registry[/\\]tables[/\\]predictions\.json$/u.test(path)) {
      return JSON.stringify(fixture.table);
    }
    return Reflect.apply(read, fs, [path, options]);
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  for (const vector of fixture.vectors) {
    assert.match(vector.spec, /^docs\/formats\/prediction\.v1\.md#/u);
    assert.deepEqual(predictEol(vector.purl, vector.version), vector.expected, vector.spec);
  }
});
