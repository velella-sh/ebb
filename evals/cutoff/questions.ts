import { readFile } from "node:fs/promises";
import type { CheckMatch, CheckStatus } from "../../src/check-core.js";
import { createEbb } from "../../src/create.js";
import { parsePurl, purlIdentity } from "../../src/purl.js";
import { isIsoDate, type RegistryV2Rule } from "../../src/registry.js";

export const questionSchema = "ebb.cutoff.questions.v1";
export const labels = ["end-of-life", "deprecated", "fine"] as const;
export type Label = (typeof labels)[number];

export interface Candidate {
  display: string;
  purl: string;
  version: string;
  outcome: Label;
  ruleIds: string[];
}

export interface Question {
  id: string;
  ecosystem: string;
  prompt: string;
  candidates: Candidate[];
}

export interface Evidence {
  event: CheckMatch["event"];
  date: string | null;
  sources: { title: string; url: string }[];
}
export interface QuestionSet {
  schemaVersion: typeof questionSchema;
  asOf: string;
  dataVersion: string;
  sha256: string;
  questions: Question[];
  evidence: Record<string, Evidence>;
}

const lexical = (a: string, b: string) => (a < b ? -1 : Number(a > b));

export function outcomeFor(status: CheckStatus, matches: readonly CheckMatch[], asOf: string): Label | undefined {
  if (["end-of-life", "unsupported", "removed"].includes(status)) return "end-of-life";
  if (status === "deprecated") return "deprecated";
  if (
    status === "scheduled" &&
    matches.length &&
    matches.every(({ event, date }) => event === "scheduled" && date !== null && date > asOf)
  )
    return "fine";
}

export function keyFromRules(set: QuestionSet, source: readonly RegistryV2Rule[]): QuestionSet {
  const evidence = new Map<string, Evidence>();
  const engines = new Map<string, ReturnType<typeof createEbb>>();
  const questions = set.questions.map((question) => {
    let engine = engines.get(question.ecosystem);
    if (engine === undefined) {
      const rules = source.filter(
        (rule) =>
          rule.ecosystem === question.ecosystem &&
          rule.provenance.observedAt <= set.asOf &&
          (!rule.usage?.length || /^(?:pkg:npm|pkg:pypi)\//u.test(rule.purl)),
      );
      engine = createEbb({ ecosystems: [rules], asOf: set.asOf });
      engines.set(question.ecosystem, engine);
    }
    const candidates = question.candidates.map(({ display, purl, version }) => {
      const { status, matches } = engine.check(purl, version);
      const outcome = outcomeFor(status, matches, set.asOf);
      if (!outcome)
        throw new Error(`No dated or affected candidate evidence for ${question.id} (${purl}@${version}, ${status}).`);
      for (const { ruleId, event, date, sources } of matches) {
        evidence.set(ruleId, { event, date, sources: sources.map(({ title, url }) => ({ title, url })) });
      }
      return { display, purl, version, outcome, ruleIds: matches.map(({ ruleId }) => ruleId).sort(lexical) };
    });
    return { ...question, candidates };
  });
  return { ...set, questions, evidence: Object.fromEntries([...evidence].sort(([a], [b]) => lexical(a, b))) };
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateQuestionSet(set: QuestionSet): void {
  if (
    set.schemaVersion !== questionSchema ||
    !isIsoDate(set.asOf) ||
    !/^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/u.test(set.dataVersion) ||
    !/^[a-f0-9]{64}$/u.test(set.sha256) ||
    !Array.isArray(set.questions) ||
    set.questions.length === 0 ||
    !set.evidence
  ) {
    throw new Error("Invalid cutoff question-set header.");
  }
  const ids = new Set<string>();
  const used = new Set<string>();
  for (const question of set.questions) {
    if (
      !question ||
      !/^[a-z0-9-]+$/u.test(question.id) ||
      ids.has(question.id) ||
      !nonempty(question.ecosystem) ||
      !nonempty(question.prompt) ||
      !Array.isArray(question.candidates) ||
      ![1, 2].includes(question.candidates.length)
    ) {
      throw new Error(`Invalid or duplicate cutoff question ${question?.id}.`);
    }
    ids.add(question.id);
    const candidates = new Set<string>();
    const displays = new Set<string>();
    for (const candidate of question.candidates) {
      const purl = parsePurl(candidate.purl);
      const pick = `${purlIdentity(purl)}@${candidate.version}`;
      if (
        purlIdentity(purl) !== candidate.purl ||
        !nonempty(candidate.version) ||
        !nonempty(candidate.display) ||
        candidates.has(pick) ||
        displays.has(candidate.display) ||
        !labels.includes(candidate.outcome) ||
        !Array.isArray(candidate.ruleIds) ||
        !candidate.ruleIds.length ||
        new Set(candidate.ruleIds).size !== candidate.ruleIds.length
      ) {
        throw new Error(`Invalid candidate in ${question.id}.`);
      }
      candidates.add(pick);
      displays.add(candidate.display);
      const matches = candidate.ruleIds.map((id) => {
        const rule = Object.hasOwn(set.evidence, id) ? set.evidence[id] : undefined;
        if (
          !rule ||
          !["end-of-life", "unsupported", "removed", "deprecated", "scheduled"].includes(rule.event) ||
          (rule.date !== null && !isIsoDate(rule.date)) ||
          !Array.isArray(rule.sources) ||
          !rule.sources.length ||
          rule.sources.some(({ title, url }) => !nonempty(title) || new URL(url).protocol !== "https:")
        ) {
          throw new Error(`Missing or invalid source evidence for ${id} in ${question.id}.`);
        }
        used.add(id);
        return { ruleId: id, ...rule, daysLeft: null, replacement: null, reviewedAt: set.asOf } satisfies CheckMatch;
      });
      const status = matches.some(({ event }) => ["end-of-life", "unsupported", "removed"].includes(event))
        ? "end-of-life"
        : matches.some(({ event }) => event === "deprecated")
          ? "deprecated"
          : "scheduled";
      if (outcomeFor(status, matches, set.asOf) !== candidate.outcome)
        throw new Error(`Evidence conflicts with the key in ${question.id}.`);
    }
  }
  if (used.size !== Object.keys(set.evidence).length) throw new Error("Question set contains unused evidence.");
}

export async function readQuestions(file: string): Promise<QuestionSet> {
  const set = JSON.parse(await readFile(file, "utf8")) as QuestionSet;
  validateQuestionSet(set);
  return set;
}
