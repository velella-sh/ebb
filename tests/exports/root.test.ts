import assert from "node:assert/strict";
import { test } from "node:test";
import * as root from "../../src/index.js";
import {
  type CheckAllEntry,
  type CheckAllError,
  type CheckAllErrorCode,
  type CheckAllItem,
  type CheckAllResult,
  type CheckAllSummary,
  type CheckEvent,
  type CheckMatch,
  type CheckResult,
  type CheckStatus,
  type EbbErrorCode,
  type EvidenceSource,
  type Result,
  type ResultEvent,
  type ResultMatch,
  type ResultStatus,
  type Rule,
  type RuleEvent,
  type RulesForOptions,
  check,
  checkAll,
  replacementFor,
  rulesFor,
} from "../../src/index.js";

test("root entry exports only the public functions at runtime", () => {
  assert.deepEqual(Object.keys(root).sort(), ["check", "checkAll", "replacementFor", "rulesFor"]);
});

test("root exports evaluate components and expose the public types", () => {
  const checked: CheckResult = check("pkg:npm/request", "2.88.2");
  const asResult: Result = checked;
  const status: CheckStatus = asResult.status;
  const firstMatch: CheckMatch | undefined = asResult.matches[0];
  const event: CheckEvent | undefined = firstMatch?.event;
  const source: EvidenceSource | undefined = firstMatch?.sources[0];
  assert.equal(status, "deprecated");
  assert.equal(event, "deprecated");
  assert.ok(source?.url.startsWith("https://"));

  const items: CheckAllItem[] = [
    { purl: "pkg:npm/request", version: "2.88.2" },
    { purl: "pkg:", version: "1.0.0" },
  ];
  const batch: CheckAllResult = checkAll(items);
  const entry0: CheckAllEntry | undefined = batch.results[0];
  const entry1: CheckAllEntry | undefined = batch.results[1];
  const summary: CheckAllSummary = batch.summary;
  assert.equal(summary.total, 2);
  assert.equal(summary.errors, 1);
  assert.ok(entry0 && entry0.status !== "error");
  assert.ok(entry1 && entry1.status === "error");
  const errEntry: CheckAllError = entry1;
  const errCode: CheckAllErrorCode = errEntry.code;
  const baseCode: EbbErrorCode = "invalid-purl";
  assert.equal(errCode, baseCode);

  const options: RulesForOptions = { event: "deprecated" satisfies RuleEvent };
  const rules: Rule[] = rulesFor("pkg:npm/request", options);
  assert.ok(rules.length > 0);
  const ruleEvent: RuleEvent = rules[0]!.event;
  assert.equal(ruleEvent, "deprecated");

  const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
  assert.equal(replacement, "pkg:npm/sass");

  // Compile-time assertions that result alias types stay identical to check aliases.
  const _resultStatus: ResultStatus = status;
  const _resultMatch: ResultMatch | undefined = firstMatch;
  const _resultEvent: ResultEvent | undefined = event;
  assert.equal(_resultStatus, "deprecated");
  assert.ok(_resultMatch);
  assert.equal(_resultEvent, "deprecated");
});
