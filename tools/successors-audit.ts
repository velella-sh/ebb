/** Inventory text successors for human review without changing any rules. */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { parsePurl, purlIdentity } from "../src/purl.js";
import type { RegistryV2Rule } from "../src/registry.js";

export const successorKinds = [
  "installable-package",
  "same-component-line",
  "api-version",
  "product",
  "no-target",
  "needs-review",
] as const;
type Kind = (typeof successorKinds)[number];
export const compareText = (a: string, b: string): number => (a < b ? -1 : Number(a > b));

function classify(rule: RegistryV2Rule, replacement: string): Kind {
  if (
    /^(?:none|n\/a|no (?:supported |direct )?(?:replacement|successor|alternative|major|version)\b)/iu.test(replacement)
  )
    return "no-target";
  if (/\b(?:apiVersion\s*[:=]|(?:[a-z][\w.-]*\.[a-z][\w.-]*)\/v\d+(?:[a-z]+\d+)?)\b/iu.test(replacement))
    return "api-version";
  const target = replacement.match(/\bpkg:[^\s`'",<>]+/u)?.[0];
  if (target) {
    try {
      const parsed = parsePurl(target);
      if (parsed.version && purlIdentity(parsed) === purlIdentity(rule.purl)) return "same-component-line";
      return parsed.type === "generic" ? "product" : "installable-package";
    } catch {
      return "needs-review";
    }
  }
  if (
    /^(?:npm|pnpm|yarn|bun|pip3?|cargo|go|dotnet)\s+(?:install|add|get)\s+\S/iu.test(replacement) ||
    /^@[a-z\d._-]+\/[a-z\d._-]+(?:@[\w.*-]+)?$/iu.test(replacement)
  )
    return "installable-package";

  const component = parsePurl(rule.purl).name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (
    new RegExp(`^(?:upgrade to |use )?${component}(?:[ .-]+|(?=\\d))(?:v|version )?\\d+(?:\\b|\\.x)`, "iu").test(
      replacement,
    )
  )
    return "same-component-line";
  if (
    /^(?:migrate|switch|move) to (?:the )?[A-Z][\w.-]+(?: [A-Za-z][\w.-]+){0,4}(?: service| product| platform)\.?$/iu.test(
      replacement,
    )
  )
    return "product";
  return "needs-review";
}

export function auditSuccessors(rules: readonly RegistryV2Rule[]) {
  const counts = Object.fromEntries(successorKinds.map((kind) => [kind, 0])) as Record<Kind, number>;
  const rows = [];
  for (const rule of [...rules].sort((a, b) => compareText(a.ecosystem, b.ecosystem) || compareText(a.id, b.id))) {
    const replacement = rule.replacement?.trim();
    if (!replacement || rule.replacements?.length) continue;
    const classification = classify(rule, replacement);
    counts[classification]++;
    rows.push({ ecosystem: rule.ecosystem, ruleId: rule.id, purl: rule.purl, replacement, classification });
  }
  return { rules: rules.length, textOnly: rows.length, counts, rows };
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
