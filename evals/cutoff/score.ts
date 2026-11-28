import type { Arm } from "./context.js";
import type { Label, Question, QuestionSet } from "./questions.js";

export interface FixtureAnswer {
  questionId: string;
  arm: Arm;
  raw: string;
  expected: Score;
}
export interface Score {
  outcome: Label | "unclear";
  choice: "A" | "B" | null;
  resolution: "identified" | "abstained" | "unrecognized";
}

export function scoreAnswer(question: Question, raw: string): Score {
  const answer = raw.trim();
  if (/^PASS[.!]?$/iu.test(answer)) return { outcome: "unclear", choice: null, resolution: "abstained" };
  const pick = /^PICK ([AB])[.!]?$/iu.exec(answer)?.[1]?.toUpperCase();
  const candidates = question.candidates;
  const matches = candidates.flatMap((candidate, index) => {
    const letter = index === 0 ? "A" : "B";
    return pick === letter ||
      (!pick && (answer === candidate.display || answer === `${candidate.purl}@${candidate.version}`))
      ? [{ outcome: candidate.outcome, choice: letter, resolution: "identified" } as const]
      : [];
  });
  return matches.length === 1 ? matches[0]! : { outcome: "unclear", choice: null, resolution: "unrecognized" };
}

export function replayFixture(set: QuestionSet, answers: readonly FixtureAnswer[]) {
  const questions = new Map(set.questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const results = answers.map(({ questionId, arm, raw, expected }) => {
    const key = `${questionId}/${arm}`;
    const question = questions.get(questionId);
    if (!question || !["baseline", "with-ebb"].includes(arm) || typeof raw !== "string" || !expected || seen.has(key)) {
      throw new Error(`Invalid or duplicate fixture response ${key}.`);
    }
    seen.add(key);
    const actual = scoreAnswer(question, raw);
    const agrees =
      actual.outcome === expected.outcome &&
      actual.choice === expected.choice &&
      actual.resolution === expected.resolution;
    return { questionId, arm, raw, actual, expected, agrees };
  });
  return {
    origin: "synthetic-fixture",
    dataVersion: set.dataVersion,
    asOf: set.asOf,
    tested: results.length,
    disagreements: results.filter(({ agrees }) => !agrees).length,
    results,
  };
}
