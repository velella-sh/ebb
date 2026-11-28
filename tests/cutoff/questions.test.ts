import assert from "node:assert/strict";
import { test } from "node:test";
import { renderPrompt } from "../../evals/cutoff/context.js";
import { keyFromRules, readQuestions, validateQuestionSet } from "../../evals/cutoff/questions.js";
import { readSiteRelease } from "../../tools/site-data/release.js";
import { readSiteReleaseLog } from "../../tools/site-data/releases.js";

const set = await readQuestions("evals/cutoff/questions.json");

test("the dated key covers 150 distinct questions, 20 ecosystems and all three outcome classes", () => {
  assert.equal(set.asOf, "2026-11-11");
  assert.equal(set.dataVersion, "2026.11.11");
  assert.equal(set.sha256, "09f3f558e6708b6f7ec8fd4df0494601d4c1c99eb50526f7db20591a3852f3a4");
  assert.equal(set.questions.length, 150);
  assert.equal(new Set(set.questions.map((q) => q.ecosystem)).size, 20);
  assert.equal(new Set(set.questions.map((q) => renderPrompt(set, q, "baseline"))).size, 150);
  assert.equal(Object.keys(set.evidence).length, 133);
  const counts = { "end-of-life": 0, deprecated: 0, fine: 0 };
  for (const question of set.questions) {
    for (const candidate of question.candidates) {
      counts[candidate.outcome]++;
      for (const ruleId of candidate.ruleIds) assert.ok(set.evidence[ruleId]?.sources.length);
      if (candidate.outcome === "fine") {
        for (const ruleId of candidate.ruleIds) {
          assert.equal(set.evidence[ruleId]?.event, "scheduled");
          assert.ok((set.evidence[ruleId]?.date ?? "") > set.asOf);
        }
      }
    }
  }
  assert.deepEqual(counts, { "end-of-life": 128, deprecated: 8, fine: 21 });
});

test("an absent source or a mismatched label fails key validation", () => {
  const noSource = structuredClone(set);
  const first = noSource.questions[0]!.candidates[0]!;
  delete noSource.evidence[first.ruleIds[0]!];
  assert.throws(() => validateQuestionSet(noSource), /Missing or invalid source evidence/u);
  const invalidLabel = structuredClone(set);
  invalidLabel.questions[0]!.candidates[0]!.outcome = "fine";
  assert.throws(() => validateQuestionSet(invalidLabel), /Evidence conflicts with the key/u);
});

const { EBB_SITE_BUNDLE, EBB_SITE_SIGNATURE, EBB_SITE_VERSION, EBB_SITE_SHA256, EBB_SITE_RELEASED_EBB } = process.env;
test("the checked-in key matches the exact public signed Ebb evidence", {
  skip: !EBB_SITE_BUNDLE || EBB_SITE_VERSION !== set.dataVersion,
}, async () => {
  assert.ok(EBB_SITE_BUNDLE && EBB_SITE_SIGNATURE && EBB_SITE_RELEASED_EBB);
  assert.equal(EBB_SITE_SHA256, set.sha256);
  const input = {
    bundlePath: EBB_SITE_BUNDLE,
    signaturePath: EBB_SITE_SIGNATURE,
    version: set.dataVersion,
    sha256: set.sha256,
    historicalVerifier: EBB_SITE_RELEASED_EBB,
  };
  const [rules, log] = await Promise.all([readSiteRelease(input), readSiteReleaseLog(input)]);
  assert.equal(log.at(-1)?.createdAt.slice(0, 10), set.asOf);
  assert.deepEqual(keyFromRules(set, rules), set);
});
