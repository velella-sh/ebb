// Behaviour cases for lifecycle rules, written as data: "this purl at this version is judged by exactly these
// rules". They check what a rule means, not how a scanner finds the package, so they need nothing but Ebb.
//
//   cases/<ecosystem>.json: { "cases": [{ "purl": "pkg:generic/nodejs", "version": "20.11.0", "rules": ["nodejs.runtime.eol-20"] }] }
//
// An empty `rules` list says that no rule may match: the version is still supported. Symbol rules (a `usage`
// entry of kind `symbol`) are left out: they judge a call in source code, not the version alone.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { purlIdentity } from "../src/purl.js";
import { registryV2Issues, validateRegistryV2 } from "../src/registry.js";
import type { RegistryV2Rule } from "../src/registry.js";
import { versContains } from "../src/vers/index.js";

export interface RuleCase {
  purl: string;
  version: string;
  /** Every rule id that must match, sorted; no other rule may match. */
  rules: string[];
}

export interface RuleCaseFailure {
  file: string;
  case: RuleCase;
  actual: string[];
}

export interface RuleCaseResult {
  /** Cases checked. */
  checked: number;
  failures: RuleCaseFailure[];
}

/** Every valid rule registry under `<root>/registry`. A file that does not validate is skipped: lint reports it. */
export async function registryRules(root: string): Promise<RegistryV2Rule[]> {
  const rules: RegistryV2Rule[] = [];
  for (const name of (await readdir(join(root, "registry"))).sort()) {
    if (!name.endsWith(".json")) continue;
    const value = JSON.parse(await readFile(join(root, "registry", name), "utf8")) as { schemaVersion?: unknown };
    if (value.schemaVersion === "ebb.registry.v2" && registryV2Issues(value).length === 0)
      rules.push(...validateRegistryV2(value).rules);
  }
  return rules;
}

function isSymbolRule(rule: RegistryV2Rule): boolean {
  return rule.usage?.some((matcher) => matcher.kind === "symbol") ?? false;
}

/** The ids of the version rules (not symbol rules) that judge `purl` at `version`, sorted. */
export function matchingRules(rules: readonly RegistryV2Rule[], purl: string, version: string): string[] {
  const identity = purlIdentity(purl);
  return rules
    .filter((rule) => !isSymbolRule(rule) && purlIdentity(rule.purl) === identity && versContains(rule.vers, version))
    .map((rule) => rule.id)
    .sort((left, right) => left.localeCompare(right));
}

function isRuleCase(value: unknown): value is RuleCase {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.purl === "string" &&
    typeof item.version === "string" &&
    Array.isArray(item.rules) &&
    item.rules.every((id) => typeof id === "string")
  );
}

/** Reads `cases/*.json`; a malformed file throws with its name. */
export async function readCases(root: string): Promise<Map<string, RuleCase[]>> {
  const files = new Map<string, RuleCase[]>();
  let names: string[];
  try {
    names = (await readdir(join(root, "cases"))).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return files;
    throw error;
  }
  for (const name of names) {
    const path = `cases/${name}`;
    const value = JSON.parse(await readFile(join(root, path), "utf8")) as { cases?: unknown };
    if (!Array.isArray(value.cases) || !value.cases.every(isRuleCase))
      throw new Error(`${path} must hold { "cases": [{ "purl", "version", "rules": [...] }] }`);
    files.set(path, value.cases);
  }
  return files;
}

/**
 * Checks the cases against the registry. With `ruleIds`, only cases that name one of those rules, or whose purl one
 * of them covers, are checked: the cases a rule change can break.
 */
export async function checkCases(root: string, ruleIds?: ReadonlySet<string>): Promise<RuleCaseResult> {
  const rules = await registryRules(root);
  const touched =
    ruleIds === undefined
      ? undefined
      : new Set(rules.filter((rule) => ruleIds.has(rule.id)).map((rule) => purlIdentity(rule.purl)));
  let checked = 0;
  const failures: RuleCaseFailure[] = [];
  for (const [file, cases] of await readCases(root)) {
    for (const item of cases) {
      if (
        ruleIds !== undefined &&
        touched !== undefined &&
        !item.rules.some((id) => ruleIds.has(id)) &&
        !touched.has(purlIdentity(item.purl))
      )
        continue;
      checked += 1;
      const actual = matchingRules(rules, item.purl, item.version);
      const expected = [...item.rules].sort((left, right) => left.localeCompare(right));
      if (actual.join("\n") !== expected.join("\n")) failures.push({ file, case: item, actual });
    }
  }
  return { checked, failures };
}

export function renderCaseFailure(failure: RuleCaseFailure): string {
  const expected = failure.case.rules.length === 0 ? "no rule" : failure.case.rules.join(", ");
  const actual = failure.actual.length === 0 ? "no rule" : failure.actual.join(", ");
  return `${failure.file}: ${failure.case.purl}@${failure.case.version} expected ${expected}, got ${actual}`;
}
