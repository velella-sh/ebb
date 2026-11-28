import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { neutralPrompt, renderPrompt } from "../../evals/cutoff/context.js";
import { readQuestions } from "../../evals/cutoff/questions.js";
import { type FixtureAnswer, replayFixture, scoreAnswer } from "../../evals/cutoff/score.js";

const set = await readQuestions("evals/cutoff/questions.json");
const question = set.questions.find(({ id }) => id === "container-001")!;

test("the two prompt arms share the choices, reference date and neutral instructions", () => {
  const baseline = renderPrompt(set, question, "baseline");
  const context = renderPrompt(set, question, "with-ebb");
  const core = baseline.slice(0, baseline.indexOf("\n\n"));
  assert.ok(context.startsWith(core));
  assert.ok(baseline.endsWith(neutralPrompt) && context.endsWith(neutralPrompt));
  assert.doesNotMatch(baseline, /https:\/\//u);
  assert.match(context, /2027-04-30/u);
  assert.match(context, /https:\/\//u);
  assert.equal(context, renderPrompt(set, question, "with-ebb"));
});

test("single picks resolve exactly while equivocation and unfamiliar choices stay unclear", () => {
  assert.deepEqual(scoreAnswer(question, "PICK A"), { outcome: "end-of-life", choice: "A", resolution: "identified" });
  assert.deepEqual(scoreAnswer(question, "node:22.11.0"), { outcome: "fine", choice: "B", resolution: "identified" });
  assert.deepEqual(scoreAnswer(question, "PASS"), { outcome: "unclear", choice: null, resolution: "abstained" });
  for (const raw of ["PICK A or B", "PICK A\nPICK B", "node:24.0.0", "I would not pick node:20.18.0"]) {
    assert.deepEqual(scoreAnswer(question, raw), { outcome: "unclear", choice: null, resolution: "unrecognized" });
  }
});

test("twenty labelled synthetic answers replay byte-for-byte and exercise every outcome", async () => {
  const fixture = JSON.parse(await readFile("evals/cutoff/fixtures/synthetic.json", "utf8")) as {
    origin: string;
    answers: FixtureAnswer[];
  };
  assert.equal(fixture.origin, "synthetic-fixture");
  const results = replayFixture(set, fixture.answers);
  assert.equal(results.origin, "synthetic-fixture");
  assert.equal(results.tested, 20);
  assert.equal(results.disagreements, 0);
  assert.deepEqual(
    new Set(results.results.map(({ actual }) => actual.outcome)),
    new Set(["fine", "unclear", "deprecated", "end-of-life"]),
  );
  assert.equal(JSON.stringify(results), JSON.stringify(replayFixture(set, fixture.answers)));
  assert.throws(
    () => replayFixture(set, [fixture.answers[0]!, fixture.answers[0]!]),
    /Invalid or duplicate fixture response/u,
  );
});
