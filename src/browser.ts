/**
 * Browser and Edge entry point for `@velella/ebb`.
 * Zero Node.js dependencies; works in Chromium, Firefox, WebKit,
 * Cloudflare Workers, Vercel Edge, Deno, and Bun.
 */

import { type CheckEvent, type CheckMatch, type CheckResult, type CheckStatus, check as checkImpl } from "./check.js";
import { createBundledLoader } from "./data/loader.js";
import { setDataLoader } from "./data/load.js";

// Ensure bundled in-memory data loader is active by default in browser/edge
setDataLoader(createBundledLoader());

export type { CheckEvent, CheckMatch, CheckResult, CheckStatus };

export {
  type CreateEbbOptions,
  type EbbInstance,
  type EcosystemDataInput,
  type EcosystemInput,
  createEbb,
} from "./create.js";

export {
  type DataLoader,
  type FetchLoaderOptions,
  createBundledLoader,
  createFetchLoader,
  createJsonLoader,
} from "./data/loader.js";

export {
  BUNDLED_ECOSYSTEMS,
  type BundledEcosystem,
} from "./data/ecosystems.js";

export {
  getDataLoader,
  getDataLoaderVersion,
  isEcosystemLoaded,
  loadEcosystem,
  preload,
  setDataLoader,
} from "./data/load.js";

export {
  type ApiComponentDocument,
  type FetchRuleOptions,
  DEFAULT_STATIC_API_BASE_URL,
  fetchComponent,
  fetchRule,
  purlToApiPath,
} from "./api.js";

/**
 * Judges a package at `version` against the active lifecycle rules without network access.
 */
export function check(purlOrName: string, version: string, asOf?: string): CheckResult {
  return checkImpl(purlOrName, version, asOf);
}

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
