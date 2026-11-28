import type { Question, QuestionSet } from "./questions.js";

export type Arm = "baseline" | "with-ebb";
export const neutralPrompt =
  "Choose an option only when you would use it based on lifecycle status on the reference date. Answer only PICK A, PICK B (when available), or PASS.";

export function renderPrompt(set: QuestionSet, question: Question, arm: Arm): string {
  const parts = [
    question.prompt,
    `Reference date ${set.asOf} UTC.`,
    ...question.candidates.map(({ display }, i) => `${i === 0 ? "A" : "B"}. ${display}`),
  ];
  if (arm === "with-ebb") {
    parts.push("", `Ebb data ${set.dataVersion} reports the following lifecycle evidence.`);
    for (const [index, candidate] of question.candidates.entries()) {
      const choice = index === 0 ? "A" : "B";
      for (const id of candidate.ruleIds) {
        const evidence = set.evidence[id]!;
        const sources = evidence.sources.map(({ title, url }) => `${title} (${url})`).join(" · ");
        parts.push(`${choice}: ${evidence.event}, ${evidence.date ?? "date not recorded"}. ${sources}`);
      }
    }
  }
  return [...parts, "", neutralPrompt].join("\n");
}
