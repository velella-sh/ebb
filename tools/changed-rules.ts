// Pull-request helper: finds the registry rules a diff touches, lints the changed registry files, and checks the
// behaviour cases (cases/*.json) those rules can change. `.github/workflows/rules.yml` runs it with --summary, so the
// pull request shows what was checked and a rule that breaks fails the job with that rule named. With --all it lints
// every registry and checks every case.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REGISTRY_V2_SCHEMA_VERSION } from "../src/registry.js";
import { lintRuleFiles, renderRuleLintText } from "../src/rule-lint.js";
import type { RuleLintResult } from "../src/rule-lint.js";
import { checkCases, renderCaseFailure } from "./rule-cases.js";
import type { RuleCaseResult } from "./rule-cases.js";

/** Generated files that live beside the rule registries but are not rule registries. */
const GENERATED_REGISTRY_FILES = new Set(["registry/sources.lock.json", "registry/github-actions-shas.json"]);

/** The `base` of a run that checks every registry and every case. */
const ALL = "(all)";

export interface ChangedPaths {
  /** Changed files under `registry/`; the runner skips files whose schema is not a rule registry. */
  files: string[];
  /** Whether a case file changed, which makes every case run. */
  cases: boolean;
}

export interface ChangedRulesResult {
  base: string;
  /** Registry files that were linted, relative to the repository root. */
  files: string[];
  /** Rule ids added or changed, sorted. */
  rules: string[];
  lint: RuleLintResult;
  cases: RuleCaseResult;
  passed: boolean;
}

export interface ChangedRulesOptions {
  /** Ref the diff is taken against, usually `origin/main`; undefined checks every registry and every case. */
  base?: string;
  root?: string;
  /** When set, the Markdown job summary is appended to this file. */
  summaryPath?: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Sorts object keys so a rule that only reorders its JSON is not reported as changed. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

interface RegistryText {
  schemaVersion: unknown;
  rules: unknown[] | undefined;
}

/** A parsed registry, or undefined when the text is not JSON at all. */
function parseRegistry(text: string): RegistryText | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return { schemaVersion: undefined, rules: undefined };
  return { schemaVersion: parsed.schemaVersion, rules: Array.isArray(parsed.rules) ? parsed.rules : undefined };
}

function isRuleRegistry(parsed: RegistryText | undefined): parsed is RegistryText & { rules: unknown[] } {
  return parsed !== undefined && parsed.schemaVersion === REGISTRY_V2_SCHEMA_VERSION && parsed.rules !== undefined;
}

function ruleFingerprints(text: string): Map<string, string> {
  const fingerprints = new Map<string, string>();
  const parsed = parseRegistry(text);
  if (!isRuleRegistry(parsed)) return fingerprints;
  for (const rule of parsed.rules) {
    if (isRecord(rule) && typeof rule.id === "string") fingerprints.set(rule.id, fingerprint(rule));
  }
  return fingerprints;
}

/**
 * What a rule means. A source's retrieval date is evidence metadata: refreshing it does not change what the rule
 * judges, so it does not count as a change.
 */
function fingerprint(rule: UnknownRecord): string {
  if (!Array.isArray(rule.sources)) return stable(rule);
  const sources: unknown[] = rule.sources;
  return stable({
    ...rule,
    sources: sources.map((source) =>
      isRecord(source) ? Object.fromEntries(Object.entries(source).filter(([key]) => key !== "accessedAt")) : source,
    ),
  });
}

/** Paths in a diff that can affect rules: registry files and `cases/*.json`. */
export function classifyChangedPaths(paths: readonly string[]): ChangedPaths {
  const files = new Set<string>();
  let cases = false;
  for (const path of paths) {
    const normalized = path.replaceAll("\\", "/");
    if (/^registry\/[^/]+\.json$/.test(normalized) && !GENERATED_REGISTRY_FILES.has(normalized)) files.add(normalized);
    if (/^cases\/[^/]+\.json$/.test(normalized)) cases = true;
  }
  return { files: [...files].sort(), cases };
}

/**
 * Rule ids added or changed between two versions of one registry file, sorted. A deleted rule is not
 * returned: there is nothing left to lint or test. An unreadable new file yields no ids; lint reports it.
 */
export function changedRuleIds(beforeText: string | undefined, afterText: string): string[] {
  const before = beforeText === undefined ? new Map<string, string>() : ruleFingerprints(beforeText);
  const after = ruleFingerprints(afterText);
  if (after.size === 0) return [];
  const changed: string[] = [];
  for (const [id, fingerprint] of after) if (before.get(id) !== fingerprint) changed.push(id);
  return changed.sort((left, right) => left.localeCompare(right));
}

/** Paths changed between the merge base of `base` and `HEAD`, relative to the repository root and with `/`. */
export function changedPaths(base: string, root = process.cwd()): string[] {
  const output = execFileSync("git", ["diff", "--name-only", "-z", `${base}...HEAD`, "--"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return output
    .split("\0")
    .filter((path) => path !== "")
    .map((path) => path.replaceAll("\\", "/"));
}

/** The base version of a changed file. A file added in the diff has none, so every head rule counts as new. */
function baseText(base: string, path: string, root: string): string | undefined {
  try {
    return execFileSync("git", ["show", `${base}:${path}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
  } catch {
    return undefined;
  }
}

export async function runChangedRules(options: ChangedRulesOptions): Promise<ChangedRulesResult> {
  const root = options.root ?? process.cwd();
  const base = options.base;
  const { files: candidates, cases: casesChanged } =
    base === undefined
      ? {
          files: (await readdir(join(root, "registry")))
            .map((name) => `registry/${name}`)
            .filter((path) => path.endsWith(".json") && !GENERATED_REGISTRY_FILES.has(path))
            .sort(),
          cases: true,
        }
      : classifyChangedPaths(changedPaths(base, root));

  const files: string[] = [];
  const changed = new Set<string>();
  for (const path of candidates) {
    if (!existsSync(join(root, path))) continue; // A deleted registry file has no rules left to check.
    const head = await readFile(join(root, path), "utf8");
    const parsed = parseRegistry(head);
    if (parsed !== undefined && !isRuleRegistry(parsed)) continue; // Locks and other generated files.
    files.push(path);
    if (base !== undefined) for (const id of changedRuleIds(baseText(base, path, root), head)) changed.add(id);
  }

  const rules = [...changed].sort((left, right) => left.localeCompare(right));
  const lint = await lintRuleFiles(files.map((path) => join(root, path)));
  const cases = await checkCases(root, base === undefined || casesChanged ? undefined : changed);
  const passed = lint.issues.length === 0 && cases.failures.length === 0;
  const result: ChangedRulesResult = { base: base ?? ALL, files, rules, lint, cases, passed };
  if (options.summaryPath !== undefined)
    await writeFile(options.summaryPath, renderChangedRulesSummary(result), { flag: "a" });
  return result;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** What was checked, then the problems that name what broke and where. */
export function renderChangedRulesSummary(result: ChangedRulesResult): string {
  const lines = ["### Changed rules", ""];
  if (result.files.length === 0 && result.cases.checked === 0) {
    lines.push("No rule changed in this pull request.", "");
    return lines.join("\n");
  }
  lines.push(
    `Linted ${plural(result.files.length, "registry file")}; ${plural(result.rules.length, "rule")} added or changed; checked ${plural(result.cases.checked, "case")}.`,
    "",
  );
  if (result.rules.length > 0) {
    lines.push("| Rule | Lint |", "| --- | --- |");
    for (const ruleId of result.rules) {
      const lintFailed = result.lint.issues.some((issue) => issue.ruleId === ruleId);
      lines.push(`| \`${ruleId}\` | ${lintFailed ? "**fail**" : "pass"} |`);
    }
    lines.push("");
  }
  lines.push(result.passed ? "Everything passed." : "Some checks failed.", "");
  if (result.lint.issues.length > 0) {
    lines.push("#### Lint problems", "", "```text", renderRuleLintText(result.lint), "```", "");
  }
  if (result.cases.failures.length > 0) {
    lines.push("#### Case problems", "", "```text", ...result.cases.failures.map(renderCaseFailure), "```", "");
  }
  return lines.join("\n");
}

export function renderChangedRulesText(result: ChangedRulesResult): string {
  if (result.files.length === 0 && result.cases.checked === 0) return "No rule changed in this pull request.";
  const lines =
    result.base === ALL
      ? []
      : [
          `Registry files: ${result.files.length === 0 ? "none" : result.files.join(", ")}`,
          `Changed rules: ${result.rules.length === 0 ? "none" : result.rules.join(", ")}`,
        ];
  if (result.files.length > 0) lines.push(renderRuleLintText(result.lint));
  lines.push(`Checked ${plural(result.cases.checked, "case")}, ${result.cases.failures.length} failed.`);
  for (const failure of result.cases.failures) lines.push(renderCaseFailure(failure));
  return lines.join("\n");
}

/** Names the rules, files and cases that broke, for the workflow log. */
export function failedNames(result: ChangedRulesResult): string[] {
  const names = new Set<string>();
  for (const issue of result.lint.issues) names.add(issue.ruleId ?? issue.file);
  for (const failure of result.cases.failures) names.add(`${failure.case.purl}@${failure.case.version}`);
  return [...names].sort((left, right) => left.localeCompare(right));
}

export async function main(argv: readonly string[]): Promise<number> {
  const options = new Map<string, string>();
  let all = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--all") {
      all = true;
      continue;
    }
    if (!["--base", "--summary"].includes(argument)) throw new Error(`Unknown argument "${argument}".`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} needs a value.`);
    options.set(argument, value);
    index += 1;
  }
  const base = options.get("--base");
  if ((base === undefined) === !all) throw new Error("Usage: changed-rules (--base <ref> | --all) [--summary <file>]");

  const summary = options.get("--summary");
  const changedOptions: ChangedRulesOptions = {};
  if (base !== undefined) changedOptions.base = base;
  if (summary !== undefined) changedOptions.summaryPath = summary;
  const result = await runChangedRules(changedOptions);
  process.stdout.write(`${renderChangedRulesText(result)}\n`);
  if (!result.passed) process.stderr.write(`Rule changes failed: ${failedNames(result).join(", ")}\n`);
  return result.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exit(2);
    },
  );
}
