import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

import { purlIdentity } from "../src/purl.js";
import { validateRegistryV2 } from "../src/registry.js";
import type { RegistryV2Rule } from "../src/registry.js";
import { versContains } from "../src/vers/index.js";
import { changedRuleIds, classifyChangedPaths, runChangedRules } from "./changed-rules.js";
import { type ReadEvidence, readEvidence, requestArchive, safeRead } from "./new-rule-source.js";
import { readCases } from "./rule-cases.js";
import type { RuleCase } from "./rule-cases.js";
import { containsDate } from "./source-date.js";

const MARKER = "<!-- ebb-new-rule-check -->";
type ArchiveSource = (url: string) => Promise<string>;

function cell(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "&#64;")
    .replace(/[\r\n]/g, " ");
}

async function archive(url: string, request: ArchiveSource): Promise<string> {
  try {
    return await request(url);
  } catch {
    return "request failed";
  }
}

export async function inspectSources(
  rule: RegistryV2Rule,
  read: ReadEvidence = readEvidence,
  request: ArchiveSource = requestArchive,
): Promise<string[][]> {
  return Promise.all(
    rule.sources.slice(0, 8).map(async (source) => {
      const text = await safeRead(source.url, read);
      const date =
        rule.deadline === undefined
          ? "no date claimed"
          : text === undefined
            ? "unverified"
            : containsDate(text, rule.deadline)
              ? `found ${rule.deadline}`
              : `could not find ${rule.deadline}`;
      const snapshot = source.archiveUrl
        ? "existing archive"
        : text === undefined
          ? "skipped (unreachable)"
          : await archive(source.url, request);
      return [source.url, text === undefined ? "unreachable" : "reachable", date, snapshot];
    }),
  );
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

const DATA_PATH = /^(registry|cases)\/[a-z0-9][a-z0-9-]*\.json$/;

function treeData(commit: string): Map<string, string> {
  const files = new Map<string, string>();
  const rows = git("ls-tree", "-rz", commit, "--", "registry/", "cases/").split("\0");
  let size = 0;
  for (const row of rows) {
    const [mode, path] = row.split("\t", 2);
    if (path && DATA_PATH.test(path)) {
      if (!mode?.startsWith("100644 blob ")) throw new Error(`Expected a regular JSON file: ${path}`);
      const content = git("show", `${commit}:${path}`);
      size += Buffer.byteLength(content);
      if (size > 32 * 1024 * 1024) throw new Error("Submitted registry and case data exceed 32 MiB.");
      files.set(path, content);
    }
  }
  return files;
}

function hasCase(cases: readonly RuleCase[], rule: RegistryV2Rule, matches: boolean): boolean {
  return cases.some(
    (entry) =>
      purlIdentity(entry.purl) === purlIdentity(rule.purl) &&
      entry.rules.includes(rule.id) === matches &&
      versContains(rule.vers, entry.version) === matches,
  );
}

async function collectReport(base: string, head: string): Promise<string> {
  if (![base, head].every((ref) => /^[a-f0-9]{40}$/.test(ref))) throw new Error("Expected base and head commit IDs.");
  const changed = classifyChangedPaths(git("diff", "--name-only", "-z", base, head, "--").split("\0"));
  const lines = [MARKER, "### Lifecycle rule checks", ""];
  if (changed.files.length === 0 && !changed.cases) return [...lines, "No registry or case data changed."].join("\n");

  const stage = await mkdtemp(join(tmpdir(), "ebb-rule-check-"));
  try {
    const previous = treeData(base);
    const current = treeData(head);
    await mkdir(join(stage, "registry"));
    await mkdir(join(stage, "cases"));
    for (const [path, content] of current) await writeFile(join(stage, path), content);

    const checks = await runChangedRules({ root: stage });
    const cases = [...(await readCases(stage)).values()].flat();
    const schema = JSON.parse(await readFile("schemas/rule.v2.schema.json", "utf8"));
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    const rules: RegistryV2Rule[] = [];
    for (const path of changed.files) {
      const content = current.get(path);
      if (!content) continue;
      const ids = new Set(changedRuleIds(previous.get(path), content));
      if (ids.size === 0) continue;
      try {
        rules.push(...validateRegistryV2(content).rules.filter(({ id }) => ids.has(id)));
      } catch {
        lines.push(`- ${cell(path)} failed registry schema validation.`);
      }
    }
    lines.push(
      checks.lint.issues.length === 0 ? "Registry lint passed." : "Registry lint found problems.",
      checks.cases.failures.length === 0
        ? `All ${checks.cases.checked} behavior cases passed.`
        : "Some behavior cases failed.",
      "",
    );
    for (const issue of checks.lint.issues.slice(0, 10)) lines.push(`- ${cell(issue.message)}`);
    for (const failure of checks.cases.failures.slice(0, 10))
      lines.push(`- Case failed for ${cell(failure.case.purl)} at ${cell(failure.case.version)}.`);
    if (rules.length > 10) lines.push("Per-rule source inspection is limited to the first 10 changed rules.");
    const downloadCache = new Map<string, Promise<string>>();
    const archiveCache = new Map<string, Promise<string>>();
    const cached = (cache: Map<string, Promise<string>>, fn: ReadEvidence) => (url: string) => {
      const previous = cache.get(url);
      if (previous) return previous;
      const pending = fn(url);
      cache.set(url, pending);
      return pending;
    };
    for (const rule of rules.slice(0, 10)) {
      const failures = checks.lint.issues.filter((issue) => issue.ruleId === rule.id);
      const match = hasCase(cases, rule, true) ? "match present" : "match missing";
      const miss = hasCase(cases, rule, false) ? "non-match present" : "non-match missing";
      lines.push(
        "",
        `**${cell(rule.id)}** — schema ${validate(rule) ? "passed" : "failed"}, lint ${failures.length === 0 ? "passed" : "failed"}, ${match}, ${miss}.`,
        "",
        "| Source | Reachability | Date in source | Archive snapshot |",
        "| --- | --- | --- | --- |",
      );
      const sources = await inspectSources(
        rule,
        cached(downloadCache, readEvidence),
        cached(archiveCache, requestArchive),
      );
      for (const row of sources) lines.push(`| ${row.map(cell).join(" | ")} |`);
      if (rule.sources.length > sources.length) lines.push("", "Only the first eight source URLs were checked.");
    }
    return lines.join("\n");
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const [base, head, output] = process.argv.slice(2);
  if (!base || !head || !output) throw new Error("Usage: new-rule-check <base-sha> <head-sha> <report-path>");
  let report: string;
  try {
    report = await collectReport(base, head);
  } catch (error) {
    report = `${MARKER}\n### Lifecycle rule checks\n\nCould not complete the rule checks. Inspect the workflow log and correct the data if needed.`;
    console.error(error);
  }
  await writeFile(output, report.slice(0, 60_000));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
