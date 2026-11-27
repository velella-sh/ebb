import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { purlIdentity } from "../../src/purl.js";
import type { RegistryV2Rule } from "../../src/registry.js";
import { releaseLineFromVers } from "../../src/rule-versions.js";

export interface EolDateId {
  purl: string;
  id: string;
  source: { url: string; date: string };
}

interface WriteEolDateOptions {
  outDir: string;
  baseUrl: string;
  rules: readonly RegistryV2Rule[];
  ids: readonly EolDateId[];
  createdAt: string;
}

type Phase = "eolFrom" | "eoasFrom" | "eoesFrom";

const releaseEvents = new Map<RegistryV2Rule["event"], Phase>([
  ["end-of-life", "eolFrom"],
  ["scheduled-end-of-life", "eolFrom"],
  ["end-of-support", "eolFrom"],
  ["end-of-active-support", "eoasFrom"],
  ["end-of-extended-support", "eoesFrom"],
]);

type ReleaseLine = Partial<Record<Phase, RegistryV2Rule>>;

export async function readEolDateIds(root: string): Promise<EolDateId[]> {
  return JSON.parse(await readFile(join(root, "tools/static-api/eoldate-ids.json"), "utf8")) as EolDateId[];
}

export function eolDateBaseUrl(staticApiUrl: string): string {
  return new URL("../eol-compat/v1/", `${staticApiUrl.replace(/\/+$/, "")}/`).href;
}

function compareRules(left: RegistryV2Rule, right: RegistryV2Rule): number {
  const byDate = (left.deadline ?? "9999-99-99").localeCompare(right.deadline ?? "9999-99-99");
  return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
}

function groupReleaseLines(rules: readonly RegistryV2Rule[], asOf: string): Map<string, ReleaseLine> {
  const lines = new Map<string, ReleaseLine>();
  for (const rule of rules) {
    if (rule.provenance.observedAt > asOf || rule.usage?.length) continue;
    const phase = releaseEvents.get(rule.event);
    if (phase === undefined) continue;
    const line = releaseLineFromVers(rule.vers);
    if (!line || line.id === "*") continue;
    const name = line.id.replace(/\.x$/, "");
    const phases = lines.get(name) ?? {};
    const previous = phases[phase];
    if (!previous || compareRules(rule, previous) < 0) phases[phase] = rule;
    lines.set(name, phases);
  }
  return lines;
}

function ended(date: string | null, asOf: string): boolean | null {
  return date === null ? null : date <= asOf;
}

function releaseOf(name: string, phases: ReleaseLine, asOf: string, baseUrl: string) {
  const eoasFrom = phases.eoasFrom?.deadline ?? null;
  const eolFrom = phases.eolFrom?.deadline ?? null;
  const eoesFrom = phases.eoesFrom?.deadline ?? null;
  const undatedEnd = phases.eolFrom?.event === "end-of-life" || phases.eolFrom?.event === "end-of-support";
  const isEol = ended(eolFrom, asOf) ?? (undatedEnd ? true : null);
  const isEoes = ended(eoesFrom, asOf);
  // Only positive dates establish maintenance. An ended standard phase can coexist with extended support.
  const isMaintained = isEol === false || isEoes === false ? true : isEol === true || isEoes === true ? false : null;
  const source = phases.eolFrom ?? phases.eoesFrom ?? phases.eoasFrom;
  return {
    name,
    codename: null,
    label: name,
    releaseDate: null,
    isLts: null,
    ltsFrom: null,
    isEoas: ended(eoasFrom, asOf),
    eoasFrom,
    isEol,
    eolFrom,
    isDiscontinued: null,
    discontinuedFrom: null,
    isEoes,
    eoesFrom,
    isMaintained,
    latest: null,
    custom: source ? { ebbRuleUrl: source.url ?? `${baseUrl}/rules/${encodeURIComponent(source.id)}.json` } : null,
  };
}

/** Write an endoflife.date-shaped view of Ebb release rules, plus the legacy shape Renovate reads. */
export async function writeEolDateApi({ outDir, baseUrl, rules, ids, createdAt }: WriteEolDateOptions): Promise<void> {
  const compatUrl = eolDateBaseUrl(baseUrl);
  const generatedAt = new Date(createdAt).toISOString();
  const asOf = generatedAt.slice(0, 10);
  const envelope = { schema_version: "1.2.1", generated_at: generatedAt };
  const products = [];
  const productsDir = join(outDir, "products");
  const renovateDir = join(outDir, "renovate");
  await mkdir(productsDir, { recursive: true });
  await mkdir(renovateDir, { recursive: true });
  for (const { purl, id } of [...ids].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid compatibility product ID: ${id}`);
    const productRules = rules.filter((rule) => purlIdentity(rule.purl) === purl);
    const lineEntries = [...groupReleaseLines(productRules, asOf)].sort(([left], [right]) =>
      right.localeCompare(left, "en", { numeric: true }),
    );
    const category = productRules[0]?.ecosystem;
    if (!category || lineEntries.length === 0) continue;

    const summary = { name: id, label: id, aliases: [], category, tags: [category] };
    const releases = lineEntries.map(([name, phases]) => {
      // Modern .NET cycles use major-only IDs in endoflife.date.
      const label = id === "dotnet" ? name.replace(/^([5-9]|[1-9]\d+)\.0$/, "$1") : name;
      return releaseOf(label, phases, asOf, baseUrl);
    });
    const result = {
      ...summary,
      versionCommand: null,
      identifiers: [{ type: "purl", id: purl }],
      labels: { eoas: "Active support", eol: "Standard support", eoes: "Extended support", discontinued: null },
      links: { icon: null, html: new URL("../../../endoflife-compat/", compatUrl).href, releasePolicy: null },
      releases,
    };
    const lastModified =
      lineEntries
        .flatMap(([, phases]) =>
          Object.values(phases).map(({ provenance }) =>
            provenance.reviewedAt <= asOf ? provenance.reviewedAt : provenance.observedAt,
          ),
        )
        .sort()
        .at(-1) ?? asOf;
    const json = JSON.stringify({ ...envelope, last_modified: `${lastModified}T00:00:00Z`, result }, null, 2);
    await writeFile(join(productsDir, `${id}.json`), json, "utf8");
    // v1 clients normally request product routes without an extension.
    await writeFile(join(productsDir, id), json, "utf8");
    await writeFile(
      join(renovateDir, `${id}.json`),
      JSON.stringify(
        releases.map((release) => ({
          cycle: release.name,
          eol: release.eolFrom ?? release.isEol ?? undefined,
        })),
        null,
        2,
      ),
      "utf8",
    );
    products.push({ ...summary, uri: `${compatUrl}products/${id}.json` });
  }
  await writeFile(
    join(outDir, "products.json"),
    JSON.stringify({ ...envelope, total: products.length, result: products }, null, 2),
    "utf8",
  );
}
