import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { backtest, formatBacktest, predictionConfidence } from "../../tools/predict/backtest.js";
import { estimateCadence } from "../../tools/predict/cadence.js";
import { formatHistory, loadHistory, type History, type ReleasedLine } from "../../tools/predict/history.js";
import { estimatePolicy, includeRustReleases, loadPolicies, policyFor } from "../../tools/predict/policies.js";

const fixtureSource = "https://example.com/releases";
const history: History = {
  runtime: "fixture",
  purl: "pkg:generic/fixture",
  registry: "fixture.json",
  scheduleUrl: fixtureSource,
  reviewedAt: "2025-12-31",
  sources: [{ title: "Example release history", url: fixtureSource, accessedAt: "2025-12-31" }],
  lines: [],
};
function line(id: string, firstReleased: string, end?: string): ReleasedLine {
  return {
    id,
    firstReleased,
    sampleVersion: id + ".0.0",
    lineVers: `vers:semver/>=${id}.0.0|<${Number(id) + 1}.0.0`,
    ...(end ? { status: "ended", end: { date: end, precision: "day" } } : { status: "supported" }),
  };
}
const first = line("1", "2020-01-01", "2020-01-31");
const second = line("2", "2021-01-01", "2021-02-10");
const third = line("3", "2022-01-01", "2022-01-21");
const target = line("4", "2023-01-01", "2023-02-03");

test("coverage history loader collects known and unknown dates and ignores Actions inventory", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ebb-predict-history-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(
    join(dir, "fixture.json"),
    JSON.stringify({ ...history, lines: [first, second, third, line("4", "2023-01-01")] }),
  );
  await writeFile(join(dir, "github-actions-inventory.json"), "{}");
  assert.equal((await loadHistory(dir))[0]?.lines.length, 4);
  assert.match(formatHistory(await loadHistory(dir)), /fixture \| 3 \| yes \| 1: 4/);
  const actual = await loadHistory();
  const counts = Object.fromEntries(
    actual
      .filter(({ runtime }) => ["go", "java", "ruby", "rust"].includes(runtime))
      .map(({ runtime, lines }) => [runtime, lines.filter(({ end }) => !end).length]),
  );
  assert.deepEqual(counts, { go: 12, java: 10, ruby: 2, rust: 1 });
});

test("cadence uses the median, preserves an irregular spread, and refuses fewer than three completed lines", () => {
  const regular = [first, line("2", "2021-01-01", "2021-01-31"), line("3", "2022-01-01", "2022-01-31")];
  assert.deepEqual(estimateCadence({ ...history, lines: regular }, target, target.firstReleased)?.predictedEnd, {
    date: "2023-01-31",
    low: "2023-01-31",
    high: "2023-01-31",
    precision: "month",
  });
  assert.deepEqual(
    estimateCadence({ ...history, lines: [first, second, third, target] }, target, target.firstReleased)?.predictedEnd,
    { date: "2023-01-31", low: "2023-01-21", high: "2023-02-10", precision: "month" },
  );
  assert.equal(estimateCadence({ ...history, lines: [first, second] }, target, target.firstReleased), undefined);
});

test("policies use successors, distinguish Java LTS, and use the vendor schedule only when allowed", async () => {
  const input = await loadPolicies();
  const records = includeRustReleases(await loadHistory(), input);
  const go = records.find(({ runtime }) => runtime === "go")!;
  const goLine = go.lines.find(({ id }) => id === "1.26") as ReleasedLine;
  const goPolicy = policyFor(go, goLine, input.policies)!;
  const scheduled = estimatePolicy(go, goLine, goPolicy, input.asOf, input.asOf, true);
  const unscheduled = estimatePolicy(go, goLine, goPolicy, input.asOf, input.asOf);
  assert.equal(scheduled?.predictedEnd.date, "2027-02-15");
  assert.ok(scheduled?.evidence.some(({ kind }) => kind === "schedule"));
  assert.ok(unscheduled && !unscheduled.evidence.some(({ kind }) => kind === "schedule"));

  const java = records.find(({ runtime }) => runtime === "java")!;
  const feature = java.lines.find(({ id }) => id === "26") as ReleasedLine;
  assert.ok(
    estimatePolicy(java, feature, policyFor(java, feature, input.policies)!, feature.firstReleased, input.asOf),
  );
  const lts = java.lines.find(({ id }) => id === "25") as ReleasedLine;
  assert.equal(policyFor(java, lts, input.policies), undefined);

  const rust = records.find(({ runtime }) => runtime === "rust")!;
  const rustLine = rust.lines.find(({ id }) => id === "1.100") as ReleasedLine;
  const rustPolicy = policyFor(rust, rustLine, input.policies)!;
  assert.equal(
    estimatePolicy(rust, rustLine, rustPolicy, input.asOf, input.asOf, true)?.predictedEnd.date,
    "2026-12-24",
  );
  assert.equal(estimatePolicy(rust, rustLine, rustPolicy, input.asOf, input.asOf)?.predictedEnd.date, "2026-12-24");

  const ruby = records.find(({ runtime }) => runtime === "ruby")!;
  assert.equal(policyFor(ruby, ruby.lines.at(-1) as ReleasedLine, input.policies), undefined);
});

test("rolling replay hides future releases and ends, fixes score counts and publishes exactly the documented table", async () => {
  const input = await loadPolicies();
  const synthetic = {
    ...history,
    lines: [first, second, third, target, line("5", "2022-06-01", "2024-11-29"), line("6", "2026-12-26", "2027-12-26")],
  };
  const scores = backtest([synthetic], input);
  assert.deepEqual(
    scores.map(({ method, lines, medianAbsoluteErrorDays, rangeHitRate }) => [
      method,
      lines,
      medianAbsoluteErrorDays,
      rangeHitRate,
    ]),
    [
      ["policy", 0, null, null],
      ["cadence", 2, 442.5, 0.5],
    ],
  );
  assert.equal(predictionConfidence(scores[1]), "low");
  const docs = await readFile("docs/predict.md", "utf8");
  const actual = formatBacktest(backtest(includeRustReleases(await loadHistory(), input), input));
  assert.equal(docs.split("<!-- backtest:begin -->")[1]?.split("<!-- backtest:end -->")[0]?.trim(), actual);
});

test("the policy and cadence documentation examples validate against prediction v1", async () => {
  const schema = JSON.parse(await readFile("schemas/prediction.v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true }).compile<Record<string, unknown>>(schema);
  const docs = await readFile("docs/formats/prediction.v1.md", "utf8");
  const examples = [...docs.matchAll(/\x60{3}json\n([\s\S]*?)\n\x60{3}/gu)].map((block) => JSON.parse(block[1]!));
  assert.deepEqual(
    examples.map(({ method }) => method),
    ["policy", "cadence"],
  );
  for (const example of examples) {
    assert.ok(validate(example), JSON.stringify(validate.errors));
    assert.equal(validate({ ...example, announced: true }), false);
  }
});
