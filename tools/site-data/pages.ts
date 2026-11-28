import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { RegistryV2Rule } from "../../src/registry.js";
import { comparisonPages, supportRules } from "./comparisons.js";
import type { ComponentRecord } from "./components.js";
import type { ReleaseLineRecord } from "./lines.js";
import type { RuleRecord } from "./rules.js";
import { deadlineMonths, releaseTimeline } from "./timeline.js";
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
  return { id: rule.id, title: rule.id, url: `/ebb/rules/${rule.slug}/` };
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
  asOf?: string | undefined;
}): Promise<void> {
  const { from, out, version, rules, asOf = version.split(".").slice(0, 3).join("-") } = options;
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

  const releaseLines = lines.map((line) => {
    const component = componentsBySlug.get(line.links.component);
    if (!component) throw new Error(`Missing product for release line ${line.id}.`);
    const rule = line.ruleId ? recordsById.get(line.ruleId) : undefined;
    if (line.ruleId && !rule) throw new Error(`Missing rule ${line.ruleId} from release line ${line.id}.`);
    const rawRule = rulesById.get(line.ruleId);
    const date = displayedDate(line.endDate, rawRule);
    const eligible = component.rules.flatMap((id) => {
      const record = rulesById.get(id);
      return record === undefined ? [] : [record];
    });
    const { standard, extended } = supportRules(line.vers, eligible);
    const supportDate = (records: readonly RegistryV2Rule[]) =>
      [...new Set(records.flatMap((record) => displayedDate(record.deadline, record).deadline ?? []))]
        .sort()
        .join(", ") || "No published date";
    const supportClaims = (records: readonly RegistryV2Rule[]) =>
      records.flatMap((record) => {
        const source = recordsById.get(record.id);
        return source === undefined
          ? []
          : [ruleLink(source), ...sourcesOf(source).map((claim) => ({ ...claim, id: `${record.id}-${claim.id}` }))];
      });
    const replacement =
      rawRule?.replacement ??
      rawRule?.replacements?.map(({ name, purl, vers }) => [name, purl, vers].filter(Boolean).join(" ")).join("; ");
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
      ...date,
      event: rawRule?.event ?? "No published event",
      lifecycleDate: date.deadline ?? "No published date",
      standardSupport: supportDate(standard),
      extendedSupport: supportDate(extended),
      replacement: replacement || "No published replacement",
      ruleId: line.ruleId || null,
      claims: {
        deadline: sourcesOf(rule),
        ruleId: rule ? [ruleLink(rule), ...sourcesOf(rule)] : [],
        lifecycleDate: sourcesOf(rule),
        standardSupport: supportClaims(standard),
        extendedSupport: supportClaims(extended),
        replacement: replacement && rule ? [ruleLink(rule), ...sourcesOf(rule)] : [],
      },
    };
  });

  const linesBySlug = new Map(releaseLines.map((line) => [line.slug, line]));
  const comparisons: ReturnType<typeof comparisonPages> = [];
  const products = components.map((component) => {
    const componentRules = component.rules.map((id) => {
      const rule = recordsById.get(id);
      if (!rule) throw new Error(`Missing rule ${id} from product ${component.id}.`);
      return rule;
    });
    const date = component.dates.earliestDeadline;
    const first = date ? componentRules.find((rule) => rule.dates.deadline === date) : undefined;
    const productLines = component.links.lines.map((slug) => {
      const line = linesBySlug.get(slug);
      if (!line) throw new Error(`Missing release line ${slug} from product ${component.id}.`);
      return line;
    });

    const timelineLines = [...productLines].sort((a, b) => {
      const first = a.deadline ?? "9999-12-31";
      const second = b.deadline ?? "9999-12-31";
      return first === second ? (a.slug < b.slug ? -1 : 1) : first < second ? -1 : 1;
    });

    const choices = comparisonPages(component, productLines, version);
    comparisons.push(...choices);
    const comparisonUrl = choices.length ? `/ebb/release-comparisons/${component.slug}/` : undefined;

    return {
      id: component.id,
      title: component.title,
      summary: component.summary,
      slug: component.slug,
      ecosystem: component.ecosystem,
      status: component.status,
      purl: component.purl,
      dataVersion: version,
      ...displayedDate(date, first ? rulesById.get(first.id) : undefined),
      ruleCount: componentRules.length,
      releaseLines: productLines.map((line) => line.id),
      timeline: timelineLines.length > 0 ? releaseTimeline(timelineLines) : undefined,
      comparisonUrl,
      claims: {
        deadline: sourcesOf(first),
        ruleCount: componentRules.map(ruleLink),
        comparisonUrl: comparisonUrl ? [{ id: component.id, title: "Compare release lines", url: comparisonUrl }] : [],
        timeline: timelineLines.flatMap((line) => {
          const reference = {
            id: `line-${line.slug}`,
            title: `${line.line} release line`,
            url: `/ebb/release-lines/${line.slug}/`,
          };
          const rule = line.ruleId ? recordsById.get(line.ruleId) : undefined;
          return rule
            ? [reference, { ...ruleLink(rule), id: `rule-${line.slug}`, title: `${line.line} lifecycle rule` }]
            : [reference];
        }),
      },
    };
  });

  const rulePages = ruleRecords.map((record) => {
    const rule = rulesById.get(record.id);
    const component = componentsBySlug.get(record.links.component);
    if (!rule || !component) throw new Error(`Missing signed rule or product for ${record.id}.`);
    const { provenance } = rule;
    return {
      id: record.id,
      slug: record.slug,
      title: record.title,
      summary: record.summary,
      status: rule.event,
      purl: rule.purl,
      vers: record.affectedRange,
      product: component.id,
      dataVersion: version,
      ...displayedDate(record.dates.deadline, rule),
      announced: record.dates.announced,
      observedAt: provenance.observedAt,
      reviewedAt: provenance.reviewedAt,
      reviewers: provenance.reviewers?.length ? provenance.reviewers : [provenance.reviewer],
      method: provenance.method,
      importer: provenance.importer,
      replacement: record.replacement,
      replacements: rule.replacements?.map(({ name, purl, kind, vers, note }) =>
        [`${name} (${kind})`, purl, vers, note].filter(Boolean).join(" · "),
      ),
      requires: rule.requires && Object.entries(rule.requires).map(([runtime, minimum]) => `${runtime} ≥ ${minimum}`),
      apiUrl: record.links.apiUrl,
      claims: { status: sourcesOf(record) },
    };
  });

  const months = deadlineMonths({
    asOf,
    version,
    rules,
    ruleSlugs: new Map(rulePages.map(({ id, slug }) => [id, slug])),
  });
  await mkdir(out, { recursive: true });
  await Promise.all([
    writeFile(join(out, "products.json"), `${JSON.stringify(uniqueLabels(products), null, 2)}\n`),
    writeFile(join(out, "release-lines.json"), `${JSON.stringify(uniqueLabels(releaseLines), null, 2)}\n`),
    writeFile(join(out, "rules.json"), `${JSON.stringify(uniqueLabels(rulePages), null, 2)}\n`),
    writeFile(join(out, "comparisons.json"), `${JSON.stringify(uniqueLabels(comparisons), null, 2)}\n`),
    writeFile(join(out, "deadline-months.json"), `${JSON.stringify(months, null, 2)}\n`),
  ]);
}
