import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

import { BUNDLED_ECOSYSTEMS } from "../src/data-bundle.js";
import { severityValues } from "../src/domain.js";
import { parsePurl, purlIdentity } from "../src/purl.js";
import { lifecycleEvents, validateRegistryV2 } from "../src/registry.js";
import type { RegistryV2Rule } from "../src/registry.js";
import { defaultRuleFiles, lintRuleFiles, renderRuleLintText } from "../src/rule-lint.js";
import { parseVers, versContains, versionScheme } from "../src/vers/index.js";
import { renderEcosystemModule } from "./build-ecosystem-modules.js";
import { checkCases, matchingRules, readCases, registryRules, renderCaseFailure } from "./rule-cases.js";

const toolRoot = fileURLToPath(new URL("../../", import.meta.url));
const biome = join(dirname(createRequire(import.meta.url).resolve("@biomejs/biome/package.json")), "bin/biome");

function format(path: string, input: string): string {
  return execFileSync(process.execPath, [biome, "format", "--stdin-file-path", path], {
    cwd: toolRoot,
    input,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

async function previous(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function addRule(root: string, rule: RegistryV2Rule, match: string, miss: string): Promise<string[]> {
  if (!/^[a-z][a-z0-9-]*$/.test(rule.ecosystem)) throw new Error("Invalid registry name.");
  const registryPath = `registry/${rule.ecosystem}.json`;
  const casePath = `cases/${rule.ecosystem}.json`;
  const modulePath = `src/data/ecosystems/${rule.ecosystem}.ts`;
  const registry = validateRegistryV2(await readFile(join(root, registryPath), "utf8"));
  const schema = JSON.parse(await readFile(join(toolRoot, "schemas/rule.v2.schema.json"), "utf8"));
  const validator = new Ajv2020({ allErrors: true });
  const validate = validator.compile(schema);
  if (!validate(rule)) throw new Error(validator.errorsText(validate.errors));
  const rules = await registryRules(root);
  if (rules.some(({ id }) => id === rule.id)) throw new Error(`Rule ID already exists: ${rule.id}`);
  const scheme = versionScheme(parseVers(rule.vers).scheme);
  scheme.compare(match, match);
  scheme.compare(miss, miss);
  if (!versContains(rule.vers, match) || versContains(rule.vers, miss)) {
    throw new Error("Confirm one version inside the range and one outside it.");
  }

  const identity = purlIdentity(rule.purl);
  const nextRules = [...registry.rules];
  let insertion = nextRules.length;
  for (let index = nextRules.length - 1; index >= 0; index--) {
    const entry = nextRules[index];
    if (entry && purlIdentity(entry.purl) === identity) {
      insertion = index + 1;
      break;
    }
  }
  nextRules.splice(insertion, 0, rule);
  const nextRegistry = { ...registry, rules: nextRules };

  const cases = (await readCases(root)).get(casePath) ?? [];
  const versions = new Set([match, miss]);
  const nextCases = cases.filter((entry) => purlIdentity(entry.purl) !== identity || !versions.has(entry.version));
  for (const version of versions) {
    nextCases.push({
      purl: rule.purl,
      version,
      rules: matchingRules([...rules, rule], rule.purl, version),
    });
  }
  const files = new Map([
    [registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`],
    [casePath, format(casePath, JSON.stringify({ cases: nextCases }))],
  ]);
  if (BUNDLED_ECOSYSTEMS.some((ecosystem) => ecosystem === rule.ecosystem)) {
    files.set(modulePath, format(modulePath, renderEcosystemModule(nextRegistry)));
  }

  // Validate a staged copy first. An invalid rule or failing case never edits the contributor's files.
  const stage = await mkdtemp(join(root, ".new-rule-"));
  try {
    await mkdir(join(stage, "registry"));
    await mkdir(join(stage, "cases"));
    for (const path of await defaultRuleFiles(root)) {
      const name = `registry/${basename(path)}`;
      await writeFile(join(stage, name), files.get(name) ?? (await readFile(path)));
    }
    for (const [path, currentCases] of await readCases(root)) {
      if (path !== casePath) await writeFile(join(stage, path), JSON.stringify({ cases: currentCases }));
    }
    await writeFile(join(stage, casePath), files.get(casePath) ?? "");
    const lint = await lintRuleFiles(await defaultRuleFiles(stage));
    if (lint.issues.length > 0) throw new Error(renderRuleLintText(lint));
    const result = await checkCases(stage, new Set([rule.id]));
    if (result.failures.length > 0) throw new Error(result.failures.map(renderCaseFailure).join("\n"));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }

  const saved = new Map<string, string | undefined>();
  try {
    for (const [path, content] of files) {
      const target = join(root, path);
      saved.set(target, await previous(target));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  } catch (error) {
    for (const [target, original] of saved) {
      if (original === undefined) await rm(target, { force: true });
      else await writeFile(target, original);
    }
    throw error;
  }
  return [...files.keys()];
}

function choice<T extends string>(value: string, choices: readonly T[]): T {
  const selected = choices.find((entry) => entry === value);
  if (selected === undefined) throw new Error(`Choose one of: ${choices.join(", ")}`);
  return selected;
}

type Ask = (label: string, fallback?: string) => Promise<string>;

export async function runNewRule(root: string, ask: Ask, today: string): Promise<string[]> {
  const purl = await ask("Unversioned package URL");
  const identity = purlIdentity(purl);
  if (purl !== identity || parsePurl(purl).version) throw new Error(`Use the canonical unversioned PURL: ${identity}`);
  const prior = (await registryRules(root)).find((entry) => purlIdentity(entry.purl) === identity);
  const type = parsePurl(purl).type;
  const ecosystem = await ask("Registry ecosystem", prior?.ecosystem ?? { pypi: "python", golang: "go" }[type] ?? type);
  const vers = await ask("Affected range (VERS)", prior?.vers);
  const event = choice(await ask(`Event (${lifecycleEvents.join("/")})`, prior?.event), lifecycleEvents);
  const deadline = await ask("Deadline (YYYY-MM-DD, Enter if unspecified)");
  const url = await ask("Authoritative HTTPS source URL", prior?.sources[0]?.url);
  const sourceTitle = await ask("Source title", prior?.sources.find((source) => source.url === url)?.title);
  const accessedAt = await ask("Date you read the source", today);
  const id = await ask("New rule ID (lowercase, dots and hyphens)");
  const title = await ask("Title");
  const summary = await ask("Summary from the source");
  const severity = choice(
    await ask(`Severity (${severityValues.join("/")})`, prior?.severity ?? "low"),
    severityValues,
  );
  const reviewer = await ask("Your GitHub handle (after checking the evidence yourself)");
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(reviewer)) throw new Error("Enter your GitHub handle.");
  const match = await ask("A released version inside the range");
  const miss = await ask("A released version outside the range");
  const answer = await ask(`Write ${id} and cases for ${match} / ${miss}? Type yes to continue`);
  if (answer !== "yes") return [];
  return addRule(
    root,
    {
      id,
      ecosystem,
      purl,
      vers,
      event,
      title,
      summary,
      severity,
      ...(deadline ? { deadline } : {}),
      sources: [{ url, title: sourceTitle, accessedAt }],
      provenance: { reviewer, observedAt: accessedAt, reviewedAt: today, method: "manual" },
    },
    match,
    miss,
  );
}

async function main(): Promise<void> {
  const lines = createInterface({
    input: process.stdin,
    output: process.stdout,
    crlfDelay: Infinity,
    terminal: process.stdin.isTTY,
  });
  const iterator = lines[Symbol.asyncIterator]();
  const ask: Ask = async (label, fallback) => {
    process.stdout.write(`${label}${fallback === undefined ? "" : ` [${fallback}]`}: `);
    const line = await iterator.next();
    if (line.done) throw new Error("Input ended before the rule was confirmed.");
    return line.value.trim() || fallback || "";
  };
  try {
    const files = await runNewRule(process.cwd(), ask, new Intl.DateTimeFormat("sv-SE").format(new Date()));
    if (files.length === 0) console.log("No files written.");
    else {
      console.log(
        `\nRule schema, lint and affected cases passed. Review the diff, then run:\ngit add -- ${files.join(" ")}\ngit commit -m "feat(rules): add lifecycle evidence"\ngit push -u origin HEAD\ngh pr create`,
      );
    }
  } finally {
    lines.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
