import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { RegistryV2Rule } from "../../src/registry.js";
import type { ComponentRecord } from "./components.js";
import type { ReleaseLineRecord } from "./lines.js";
import type { RuleRecord } from "./rules.js";
import { compileSiteDataSchema } from "./validate.js";

type SiteRecord = ComponentRecord | ReleaseLineRecord | RuleRecord;

interface Claim {
  id: string;
  title: string;
  url: string;
}

function sourcesOf(rule: RuleRecord | undefined): Claim[] {
  return (rule?.sources ?? []).map((source, index) => ({
    id: `source-${index + 1}`,
    title: source.title,
    url: source.url,
  }));
}

function ruleLink(rule: RuleRecord): Claim {
  return { id: rule.id, title: rule.id, url: rule.links.apiUrl };
}

function monthPrecision(rule: RegistryV2Rule | undefined): string | undefined {
  for (const [field, value] of Object.entries(rule ?? {})) {
    if (!field.startsWith("x-") || typeof value !== "object" || value === null || !("endOfLifeMonth" in value))
      continue;
    const month = value.endOfLifeMonth;
    if (typeof month === "string" && /^\d{4}-\d{2}$/u.test(month)) return month;
  }
  return undefined;
}

function displayedDate(date: string | null | undefined, rule: RegistryV2Rule | undefined) {
  const month = monthPrecision(rule);
  if (month !== undefined) return { deadline: month, precision: "month" };
  if (date) return { deadline: date, precision: "day" };
  return { deadline: null, precision: "No published date" };
}

function uniqueLabels<T extends { title: string; summary: string; id: string }>(records: T[]): T[] {
  const titles = new Map<string, number>();
  const summaries = new Map<string, number>();
  for (const record of records) {
    titles.set(record.title, (titles.get(record.title) ?? 0) + 1);
    summaries.set(record.summary, (summaries.get(record.summary) ?? 0) + 1);
  }
  return records.map((record) => ({
    ...record,
    title: titles.get(record.title) === 1 ? record.title : `${record.title} (${record.id})`,
    summary: summaries.get(record.summary) === 1 ? record.summary : `Lifecycle evidence for ${record.id}.`,
  }));
}

export async function writeSitePages(options: {
  from: string;
  out: string;
  version: string;
  rules: readonly RegistryV2Rule[];
}): Promise<void> {
  const { from, out, version, rules } = options;
  const validate = await compileSiteDataSchema();

  async function readCollection<T extends SiteRecord>(name: string): Promise<T[]> {
    const doc: unknown = JSON.parse(await readFile(join(from, `${name}.json`), "utf8"));
    if (
      !validate(doc) ||
      typeof doc !== "object" ||
      doc === null ||
      !("dataVersion" in doc) ||
      doc.dataVersion !== version ||
      !("records" in doc) ||
      !Array.isArray(doc.records)
    ) {
      throw new Error(`Invalid site collection ${name} for release ${version}: ${JSON.stringify(validate.errors)}`);
    }
    return doc.records;
  }

  const [components, lines, ruleRecords] = await Promise.all([
    readCollection<ComponentRecord>("components"),
    readCollection<ReleaseLineRecord>("lines"),
    readCollection<RuleRecord>("rules"),
  ]);
  const recordsById = new Map(ruleRecords.map((rule) => [rule.id, rule]));
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const componentsBySlug = new Map(components.map((component) => [component.slug, component]));
  const linesBySlug = new Map(lines.map((line) => [line.slug, line]));

  const products = components.map((component) => {
    const componentRules = component.rules.map((id) => {
      const rule = recordsById.get(id);
      if (!rule) throw new Error(`Missing rule ${id} from product ${component.id}.`);
      return rule;
    });
    const date = component.dates.earliestDeadline;
    const first = date ? componentRules.find((rule) => rule.dates.deadline === date) : undefined;
    const releaseLines = component.links.lines.map((slug) => {
      const line = linesBySlug.get(slug);
      if (!line) throw new Error(`Missing release line ${slug} from product ${component.id}.`);
      return line.id;
    });

    return {
      id: component.id,
      title: component.title,
      summary: component.summary,
      slug: component.slug,
      ecosystem: component.ecosystem,
      purl: component.purl,
      dataVersion: version,
      ...displayedDate(date, first ? rulesById.get(first.id) : undefined),
      ruleCount: componentRules.length,
      releaseLines,
      claims: { deadline: sourcesOf(first), ruleCount: componentRules.map(ruleLink) },
    };
  });

  const releaseLines = lines.map((line) => {
    const component = componentsBySlug.get(line.links.component);
    if (!component) throw new Error(`Missing product for release line ${line.id}.`);
    const rule = line.ruleId ? recordsById.get(line.ruleId) : undefined;
    if (line.ruleId && !rule) throw new Error(`Missing rule ${line.ruleId} from release line ${line.id}.`);
    return {
      id: line.id,
      slug: line.slug,
      title: line.title,
      summary: line.summary,
      status: line.status,
      line: line.line,
      vers: line.vers,
      purl: component.purl,
      product: component.id,
      dataVersion: version,
      ...displayedDate(line.endDate, rulesById.get(line.ruleId)),
      ruleId: line.ruleId || null,
      claims: { deadline: sourcesOf(rule), ruleId: rule ? [ruleLink(rule), ...sourcesOf(rule)] : [] },
    };
  });

  await mkdir(out, { recursive: true });
  await Promise.all([
    writeFile(join(out, "products.json"), `${JSON.stringify(uniqueLabels(products), null, 2)}\n`),
    writeFile(join(out, "release-lines.json"), `${JSON.stringify(uniqueLabels(releaseLines), null, 2)}\n`),
  ]);
}
