/** Inventory text successors for human review without changing any rules. */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { RegistryV2Rule } from "../src/registry.js";
import { classifySuccessor, type SuccessorKind, successorKinds } from "../src/successor-text.js";

export { successorKinds };

export const compareText = (a: string, b: string): number => (a < b ? -1 : Number(a > b));

export function auditSuccessors(rules: readonly RegistryV2Rule[]) {
  const counts = Object.fromEntries(successorKinds.map((kind) => [kind, 0])) as Record<SuccessorKind, number>;
  const rows = [];
  const ecosystems: Record<string, { rules: number; textOnly: number }> = Object.create(null);
  for (const rule of [...rules].sort((a, b) => compareText(a.ecosystem, b.ecosystem) || compareText(a.id, b.id))) {
    const ecosystem = (ecosystems[rule.ecosystem] ??= { rules: 0, textOnly: 0 });
    ecosystem.rules++;
    const replacement = rule.replacement?.trim();
    if (!replacement || rule.replacements?.length) continue;
    const classification = classifySuccessor(rule.purl, replacement);
    counts[classification]++;
    ecosystem.textOnly++;
    rows.push({ ecosystem: rule.ecosystem, ruleId: rule.id, purl: rule.purl, replacement, classification });
  }
  return { rules: rules.length, textOnly: rows.length, counts, ecosystems, rows };
}

export function markdownText(value: string): string {
  return value
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/[\\`*_\[\]<>|]/gu, "\\$&")
    .replaceAll(":", "&#58;");
}

async function main(args: string[]) {
  const { values } = parseArgs({
    args,
    options: { registry: { type: "string", default: "registry" }, json: { type: "boolean" } },
  });
  const files = (await readdir(values.registry)).filter((file) => file.endsWith(".json")).sort();
  const rules = [];
  for (const file of files) {
    const document = JSON.parse(await readFile(join(values.registry, file), "utf8")) as { rules?: RegistryV2Rule[] };
    if (Array.isArray(document.rules)) rules.push(...document.rules);
  }
  if (!rules.length) throw new Error("No registry rules were loaded.");
  const audit = auditSuccessors(rules);
  if (values.json) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }
  const lines = [
    "# Text-only successor audit",
    "",
    `${audit.textOnly} of ${audit.rules} rules have a text-only successor field.`,
    "",
    ...successorKinds.map((kind) => `- ${kind}: ${audit.counts[kind]}`),
    "",
    "| Ecosystem | Rules | Text-only |",
    "| --- | ---: | ---: |",
    ...Object.entries(audit.ecosystems).map(([name, { rules, textOnly }]) => `| ${name} | ${rules} | ${textOnly} |`),
    "",
    "| Ecosystem | Rule | Component | Candidate class | Replacement text |",
    "| --- | --- | --- | --- | --- |",
    ...audit.rows.map(
      (row) =>
        `| ${row.ecosystem} | ${row.ruleId} | ${markdownText(row.purl)} | ${row.classification} | ${markdownText(row.replacement)} |`,
    ),
  ];
  console.log(lines.join("\n"));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
