import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { confidenceOf } from "../src/confidence.js";
import type { ReleaseLogEntry } from "../src/data-release-log.js";
import { diffRules } from "../src/diff.js";
import type { EvidenceSource } from "../src/domain.js";
import { recent, type RecentItem } from "../src/recent.js";
import { isIsoDate, type RegistryV2Rule } from "../src/registry.js";
import { addDays, addMonths, upcoming } from "../src/upcoming.js";
import { readSiteRelease, type SiteReleaseInput } from "./site-data/release.js";
import { readSiteReleaseLog } from "./site-data/releases.js";
import { generateRuleRecords } from "./site-data/rules.js";
import { SlugTracker } from "./site-data/slug.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const site = "https://velella.sh/ebb";
const repository = "https://github.com/velella-sh/ebb";

function text(value: string): string {
  return value
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[\\`*_[\]<>]/gu, "\\$&");
}

function link(label: string, href: string): string {
  const url = new URL(href);
  if (url.protocol !== "https:") throw new Error("Expected an HTTPS evidence URL.");
  return `[${text(label)}](<${url.href.replace(/[<>]/gu, (c) => encodeURIComponent(c))}>)`;
}

function asOfMonth(month: string): string {
  const date = month + "-01";
  if (!isIsoDate(date)) throw new Error(`Expected a report month in YYYY-MM format, got "${month}".`);
  return date;
}

function previousWindow(asOf: string, log: readonly ReleaseLogEntry[]) {
  const start = addMonths(asOf, -1);
  const published = log.filter(({ createdAt }) => createdAt.slice(0, 10) >= start && createdAt.slice(0, 10) < asOf);
  return {
    start,
    end: addDays(asOf, -1),
    baseline: log.filter(({ createdAt }) => createdAt.slice(0, 10) < start).at(-1),
    last: published.at(-1),
  };
}

interface ReportOptions {
  month: string;
  rules: readonly RegistryV2Rule[];
  ruleSlugs: ReadonlyMap<string, string>;
  releaseLog: readonly ReleaseLogEntry[];
  baselineRules?: readonly RegistryV2Rule[] | undefined;
}

interface TideReport {
  month: string;
  markdown: string;
  card: { title: string; description: string };
}

type Deadline = Pick<RecentItem, "ruleId" | "title" | "deadline" | "datePrecision" | "sources">;

const byDateAndId = (left: Deadline, right: Deadline) =>
  left.deadline === right.deadline
    ? left.ruleId < right.ruleId
      ? -1
      : Number(left.ruleId > right.ruleId)
    : left.deadline < right.deadline
      ? -1
      : 1;
const dateLabel = (item: Deadline) => (item.datePrecision === "month" ? item.deadline.slice(0, 7) : item.deadline);

export function renderTideReport({ month, rules, ruleSlugs, releaseLog, baselineRules }: ReportOptions): TideReport {
  const asOf = asOfMonth(month);
  const release = releaseLog.at(-1);
  if (!release || release.createdAt.slice(0, 10) > asOf) {
    throw new Error(`A signed data snapshot dated on or before ${asOf} UTC is required.`);
  }
  const nextMonth = addMonths(asOf, 1);
  const prev = previousWindow(asOf, releaseLog);
  const reviewedRules = rules.filter((rule) => rule.provenance.observedAt <= asOf);
  const ruleById = new Map(reviewedRules.map((rule) => [rule.id, rule]));
  const upcomingDays = upcoming({ asOf, within: 90, rules: reviewedRules });
  const announced = upcomingDays.items.filter(({ estimated }) => !estimated).sort(byDateAndId);
  const estimated = upcomingDays.items.filter(({ estimated }) => estimated).sort(byDateAndId);
  const thisMonth = announced.filter(({ deadline }) => deadline < nextMonth);
  const next90 = announced.filter(({ deadline }) => deadline >= nextMonth);
  const lastMonth = recent({
    asOf: prev.end,
    within: (Date.parse(prev.end) - Date.parse(prev.start)) / 86_400_000,
    rules: reviewedRules,
  })
    .items.filter(({ estimated }) => !estimated)
    .sort(byDateAndId);

  const label = new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(asOf),
  );
  const title = `Tide report — ${label}`;

  function ruleLine(id: string, title: string, sources: readonly EvidenceSource[]): string {
    const slug = ruleSlugs.get(id);
    if (!slug || !sources.length) throw new Error(`Missing signed rule destination or evidence for ${id}.`);
    const evidence = sources.map(({ title, url }) => link(title, url)).join(" · ");
    return `${link(title, `${site}/rules/${slug}/`)} — ${evidence}`;
  }

  function deadlineLine(item: Deadline, qualifier = ""): string {
    return `- ${dateLabel(item)}${qualifier} — ${ruleLine(item.ruleId, item.title, item.sources)}`;
  }

  const changes: string[] = [];
  if (!prev.last) {
    changes.push("The signed release log lists no release dated in this period.");
  } else if (!prev.baseline) {
    changes.push("The signed release log has no earlier baseline for this period.");
  } else if (prev.last.version !== release.version || baselineRules === undefined) {
    changes.push("Comparing changes for this period requires both signed snapshots that bound it.");
  } else {
    const diff = diffRules(baselineRules, reviewedRules);
    changes.push(`Signed comparison ${prev.baseline.version} → ${release.version}.`);
    const byId = (left: RegistryV2Rule, right: RegistryV2Rule) =>
      left.id < right.id ? -1 : Number(left.id > right.id);
    const updated = [...diff.changed, ...diff.renamed].map(({ toRule }) => toRule).sort(byId);
    for (const rule of [...diff.added].sort(byId))
      changes.push(`- Added — ${ruleLine(rule.id, rule.title, rule.sources)}`);
    for (const rule of updated) changes.push(`- Changed — ${ruleLine(rule.id, rule.title, rule.sources)}`);
    if (!diff.added.length && !diff.changed.length && !diff.renamed.length) changes.push("No new or changed rules.");
  }
  const markdown = [
    `<!-- ebb-tide-report:${month} -->`,
    `# ${title}`,
    "",
    `As of ${asOf} UTC · Signed data ${link(release.version, `${repository}/releases/tag/data-v${release.version}`)}`,
    "",
    "## Ending this month",
    "",
    ...(thisMonth.length ? thisMonth.map((item) => deadlineLine(item)) : ["No announced deadlines this month."]),
    "",
    "## Ending in the next 90 days",
    "",
    `After this month through ${upcomingDays.until} UTC.`,
    "",
    ...(next90.length
      ? next90.map((item) => deadlineLine(item))
      : ["No additional announced deadlines in this window."]),
    "",
    "## Predicted ends",
    "",
    ...(estimated.length
      ? estimated.map((item) =>
          deadlineLine(item, ` (estimate, rule confidence ${confidenceOf(ruleById.get(item.ruleId)!)})`),
        )
      : ["This signed snapshot lists no estimated deadlines in the window."]),
    "",
    "## New and changed rules last month",
    "",
    `${prev.start} through ${prev.end} UTC.`,
    "",
    ...changes,
    "",
    "### Announced deadlines that fell last month",
    "",
    ...(lastMonth.length
      ? lastMonth.map((item) => deadlineLine(item))
      : ["No announced deadlines recorded in this window."]),
    "",
  ].join("\n");

  const highlights = announced.slice(0, 3).map((item) => {
    const characters = [...item.title];
    const label = characters.length > 46 ? characters.slice(0, 45).join("") + "…" : item.title;
    return `${dateLabel(item)} ${label}`;
  });
  return {
    month,
    markdown,
    card: { title, description: highlights.join(" · ") || "No announced deadlines in this window." },
  };
}

/** Reuse the same pinned native renderer, brand asset, font and template as the published Ebb site. */
export async function renderTideCard(report: TideReport, tools: string, output: string): Promise<void> {
  const stage = await mkdtemp(join(tmpdir(), "ebb-tide-card-"));
  try {
    const source = join(stage, "site");
    const social = "_templates/social";
    const font = `${social}/manrope-regular.ttf`;
    await Promise.all([
      mkdir(join(source, social), { recursive: true }),
      mkdir(join(source, "brand"), { recursive: true }),
    ]);
    const files = [`${social}/lifecycle.svg`, font, "brand/icon-192.png"];
    await Promise.all(files.map((file) => copyFile(join(root, "docs", file), join(source, file))));
    const config = {
      title: "Ebb",
      url: "https://velella.sh",
      base: "/ebb",
      lang: "en",
      social: { template: "lifecycle", fonts: [font] },
    };
    await writeFile(join(source, "mizzen.yml"), JSON.stringify(config));
    await writeFile(join(source, "index.md"), `---\n${JSON.stringify(report.card)}\n---\n`);
    const out = join(stage, "out");
    execFileSync(
      join(tools, ".bin", "mizzen"),
      ["build", source, "--theme", join(tools, "@velella/lateen"), "--out", out],
      { timeout: 30_000 },
    );
    await mkdir(dirname(output), { recursive: true });
    await copyFile(join(out, "assets/social/index.png"), output);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function main(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      month: { type: "string" },
      bundle: { type: "string" },
      signature: { type: "string" },
      "data-version": { type: "string" },
      sha256: { type: "string" },
      "historical-verifier": { type: "string" },
      "previous-bundle": { type: "string" },
      "site-tools": { type: "string" },
      card: { type: "string" },
    },
  });
  const {
    bundle,
    signature,
    month,
    sha256,
    "data-version": version,
    "historical-verifier": historicalVerifier,
  } = values;
  if (!month || !bundle || !signature || !version || !sha256) {
    throw new Error(
      "Required options: --month YYYY-MM --bundle FILE --signature FILE --data-version VERSION --sha256 SHA256.",
    );
  }
  const asOf = asOfMonth(month);
  const input: SiteReleaseInput = {
    bundlePath: bundle,
    signaturePath: signature,
    version,
    sha256,
    historicalVerifier: version === "2026.11.11" ? historicalVerifier : undefined,
  };
  const [rules, releaseLog] = await Promise.all([readSiteRelease(input), readSiteReleaseLog(input)]);
  let baselineRules: readonly RegistryV2Rule[] | undefined;
  if (values["previous-bundle"]) {
    const previous = previousWindow(asOf, releaseLog);
    if (!previous.baseline || previous.last?.version !== version) {
      throw new Error("The signed log does not identify two snapshots that bound the previous month.");
    }
    const baseline = values["previous-bundle"];
    const entry = previous.baseline;
    baselineRules = await readSiteRelease({
      bundlePath: baseline,
      signaturePath: baseline + ".sigstore.json",
      version: entry.version,
      sha256: entry.bundleSha256.slice("sha256:".length),
      historicalVerifier: entry.version === "2026.11.11" ? historicalVerifier : undefined,
    });
  }
  const records = generateRuleRecords(rules, SlugTracker.fromFile(join(root, "tools/site-data/slugs.lock.json")));
  const ruleSlugs = new Map([...records].map(([id, { slug }]) => [id, slug]));
  const report = renderTideReport({ month, rules, ruleSlugs, releaseLog, baselineRules });
  if (values.card) {
    if (!values["site-tools"]) throw new Error(`--site-tools is required to render ${basename(values.card)}.`);
    await renderTideCard(report, resolve(values["site-tools"]), resolve(values.card));
  }
  process.stdout.write(report.markdown);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
