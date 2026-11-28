import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { check } from "../../src/index.js";
import { predictEol, predictions } from "../../src/predict.js";
import { generatePredictions, predictionFile, predictTable } from "../../tools/predict/generate.js";
import { loadHistory } from "../../tools/predict/history.js";
import { loadPolicies } from "../../tools/predict/policies.js";
import { generateStaticApi, sha256Hex } from "../../tools/static-api/generate.js";

const go = "pkg:generic/golang";
const date = "2026-11-28";
const version = "1.26.0";
const goEstimate = () => predictEol(go, version);

test("prediction table generation is byte-stable and fresh under the normal npm gate", async () => {
  const [committed, one, two] = await Promise.all([
    readFile(predictionFile, "utf8"),
    generatePredictions(),
    generatePredictions(),
  ]);
  assert.equal(one, two);
  assert.equal(committed, one, "Run npm run build && node dist/tools/predict/generate.js to refresh the table.");
});

test("a material history change invalidates the input fingerprint even when current predictions stay the same", async () => {
  const [histories, policy] = await Promise.all([loadHistory(), loadPolicies()]);
  const first = predictTable(histories, policy, new Map());
  const next = predictTable(
    histories.map((history) =>
      history.runtime === "bun" ? { ...history, coverageLimit: "Changed upstream coverage note." } : history,
    ),
    policy,
    new Map(),
  );
  assert.notEqual(first.inputSha256, next.inputSha256);
  assert.deepEqual(first.predictions, next.predictions);
});

test("offline predictions expose evidence and do not set lifecycle status or override official dates", () => {
  const result = goEstimate();
  assert.equal(result?.line, "1.26");
  assert.equal(result?.method, "policy");
  assert.equal(result?.dataVersion, "2026.11.28");
  assert.deepEqual(result, predictions(go)[0]);
  assert.equal(predictEol(go, "1.25.0"), null);
  assert.equal(predictEol("pkg:npm/unknown-prediction-fixture", "1.26.0"), null);
  assert.equal(predictEol("pkg:generic/rust", "1.99.0"), null);
  assert.equal(check(go, version, date).status, "ok");
  assert.equal(check(go, "1.25.0", date).status, "unsupported");
});

function versions(purl: string, ...args: string[]): string {
  return execFileSync(process.execPath, ["dist/src/bin.js", "versions", purl, "--as-of", date, ...args], {
    encoding: "utf8",
  });
}

test("CLI text and JSON retain authoritative dates and mark estimates when present", () => {
  assert.ok(versions(go).split("\n").includes("1.26 predicted Feb 2027 (2027-01-25 to 2027-03-07, medium confidence)"));
  assert.ok(versions(go, "--format", "markdown").includes("- 1.26 predicted Feb 2027"));
  const json = JSON.parse(versions(go, "--json"));
  assert.equal(json.recommendation, null);
  assert.equal(
    json.lines.some(({ id }: { id: string }) => id === "1.26"),
    false,
  );
  assert.deepEqual(json.predicted[0], goEstimate());

  const withOfficialDate = "pkg:generic/java";
  assert.doesNotMatch(versions(withOfficialDate), / predicted /u);
  const datedJson = JSON.parse(versions(withOfficialDate, "--json"));
  assert.equal(Object.hasOwn(datedJson, "predicted"), false);
  const historical = JSON.parse(
    execFileSync(process.execPath, ["dist/src/bin.js", "versions", go, "--as-of", "2026-11-27", "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(Object.hasOwn(historical, "predicted"), false);
});

test("static file matches the generated package bytes and the public index hash", async (t) => {
  const out = await mkdtemp(join(tmpdir(), "ebb-static-prediction-"));
  t.after(() => rm(out, { recursive: true, force: true }));
  await generateStaticApi({ outDir: out });
  const target = await readFile(join(out, "predictions.json"));
  assert.deepEqual(target, await readFile(predictionFile));
  const index = JSON.parse(await readFile(join(out, "index.json"), "utf8"));
  assert.deepEqual(index.predictions, {
    path: "predictions.json",
    sha256: sha256Hex(target),
    dataVersion: "2026.11.28",
  });
  const openapi = JSON.parse(await readFile(join(out, "openapi.json"), "utf8"));
  assert.ok(openapi.paths["/predictions.json"]);
});
