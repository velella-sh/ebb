/**
 * Public root entry point for `@velella/ebb`.
 */

import {
  type CheckEvent,
  type CheckMatch,
  type CheckResult,
  type CheckStatus,
  check as checkFromSubpath,
} from "./check.js";
import { getActiveDataSync } from "./data-source.js";
import { setNodeLoaderProvider } from "./data/load.js";

// Connect active data resolver to the data loader subsystem in Node
setNodeLoaderProvider(getActiveDataSync);

export type { CheckEvent, CheckMatch, CheckResult, CheckStatus };

export {
  type CreateEbbOptions,
  type EbbInstance,
  type EcosystemDataInput,
  type EcosystemInput,
  createEbb,
} from "./create.js";

export { preload } from "./data/load.js";

/**
 * Judges a package at `version` against the active lifecycle rules without network access.
 */
export function check(purlOrName: string, version: string, asOf?: string): CheckResult {
  // Keep `@deprecated` from the legacy `./check.js` subpath off the root entry point.
  return checkFromSubpath(purlOrName, version, asOf);
}

export {
  type AsOfClient,
  type AsOfOptions,
  asOf,
} from "./as-of.js";

export {
  type CheckAllEntry,
  type CheckAllError,
  type CheckAllErrorCode,
  type CheckAllItem,
  type CheckAllResult,
  type CheckAllSummary,
  checkAll,
} from "./check-all.js";

export type { EvidenceSource, Severity } from "./domain.js";
export type { EbbErrorCode } from "./errors.js";
export type { RegistryV2Rule } from "./registry.js";
export type { DataSourceOptions } from "./data-source.js";
export type { DataBundle } from "./data-bundle.js";
export { replacementFor } from "./replacement.js";
export type { Result, ResultEvent, ResultMatch, ResultStatus } from "./result.js";
export {
  type Rule,
  type RuleEvent,
  type RulesForOptions,
  rulesFor,
} from "./rules-for.js";

export {
  type UpcomingItem,
  type UpcomingOptions,
  type UpcomingResult,
  upcoming,
} from "./upcoming.js";

export {
  type StaleFinding,
  type StaleOptions,
  type StaleResult,
  stale,
} from "./stale.js";

export {
  type SourceEntry,
  type SourceHealthStatus,
  type SourcesOfOptions,
  type SourcesOfResult,
  sourcesOf,
} from "./sources-of.js";
