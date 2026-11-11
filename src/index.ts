/**
 * Public root entry point for `@velella/ebb`.
 */

export {
  type CheckEvent,
  type CheckMatch,
  type CheckResult,
  type CheckStatus,
  check,
} from "./check.js";
export {
  type CheckAllEntry,
  type CheckAllError,
  type CheckAllErrorCode,
  type CheckAllItem,
  type CheckAllResult,
  type CheckAllSummary,
  checkAll,
} from "./check-all.js";
export type { EvidenceSource } from "./domain.js";
export type { EbbErrorCode } from "./errors.js";
export { replacementFor } from "./replacement.js";
export type { Result, ResultEvent, ResultMatch, ResultStatus } from "./result.js";
export {
  type Rule,
  type RuleEvent,
  type RulesForOptions,
  rulesFor,
} from "./rules-for.js";

export const __ciDriftVerify = 1;
