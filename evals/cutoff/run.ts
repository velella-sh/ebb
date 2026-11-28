import { readFile } from "node:fs/promises";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { readSiteRelease } from "../../tools/site-data/release.js";
import { readSiteReleaseLog } from "../../tools/site-data/releases.js";
import { renderPrompt } from "./context.js";
import { keyFromRules, readQuestions } from "./questions.js";
import { type FixtureAnswer, replayFixture } from "./score.js";

async function main(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      questions: { type: "string", default: "evals/cutoff/questions.json" },
      fixture: { type: "string", default: "evals/cutoff/fixtures/synthetic.json" },
      prompts: { type: "boolean" },
      bundle: { type: "string" },
      signature: { type: "string" },
      "historical-verifier": { type: "string" },
    },
  });
  const set = await readQuestions(values.questions);
  if (values.bundle || values.signature || values["historical-verifier"]) {
    if (!values.bundle || !values.signature) throw new Error("Supply both the signed bundle and detached signature.");
    const input = {
      bundlePath: values.bundle,
      signaturePath: values.signature,
      version: set.dataVersion,
      sha256: set.sha256,
      historicalVerifier: set.dataVersion === "2026.11.11" ? values["historical-verifier"] : undefined,
    };
    const [rules, log] = await Promise.all([readSiteRelease(input), readSiteReleaseLog(input)]);
    if (log.at(-1)?.createdAt.slice(0, 10) !== set.asOf || !isDeepStrictEqual(keyFromRules(set, rules), set)) {
      throw new Error("Question key differs from the authenticated release or reference day.");
    }
    console.error(`Verified ${set.questions.length} questions against signed data ${set.dataVersion}.`);
  }
  if (values.prompts) {
    console.log(
      JSON.stringify(
        set.questions.map((question) => ({
          id: question.id,
          baseline: renderPrompt(set, question, "baseline"),
          withEbb: renderPrompt(set, question, "with-ebb"),
        })),
        null,
        2,
      ),
    );
    return;
  }
  const fixture = JSON.parse(await readFile(values.fixture, "utf8")) as { origin: string; answers: FixtureAnswer[] };
  if (fixture.origin !== "synthetic-fixture" || !Array.isArray(fixture.answers) || !fixture.answers.length) {
    throw new Error("Expected a labelled synthetic response fixture. This command does not record model runs.");
  }
  const results = replayFixture(set, fixture.answers);
  console.log(JSON.stringify(results, null, 2));
  if (results.disagreements) process.exitCode = 1;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
