/** Project authenticated local inputs into a deterministic coverage report and weekly snapshot. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { confidenceOf } from "../../src/confidence.js";
import { purlIdentity } from "../../src/purl.js";
import { DEFAULT_MAX_REVIEW_AGE_DAYS, isIsoDate, type RegistryV2Rule } from "../../src/registry.js";
import { type LockEntry, SOURCE_LOCK_SCHEMA } from "../check-sources.js";
import { readSiteRelease, type SiteReleaseInput } from "../site-data/release.js";
import { readSiteReleaseLog } from "../site-data/releases.js";
import { compareText, markdownText } from "../successors-audit.js";
import { renderCoverageCard } from "./card.js";
import { buildGaps, gapKinds, type ProductRequest, renderGaps, type SourceHealth } from "./gaps.js";
import { archiveWeeks, type CoverageWeek, loadWeeks, weekOf } from "./history.js";
import { type ExpectedRuntime, loadExpectedRuntimes } from "./runtimes.js";

type Observation = Pick<LockEntry, "checkedAt" | "status" | "archiveUrl"> & { archivedAt?: string };
interface Inputs {
  asOf: string;
  dataVersion: string;
  bundleSha256: string;
  checkout: string;
  lockSha256: string;
  rules: readonly RegistryV2Rule[];
  runtimes: readonly ExpectedRuntime[];
  freshness: Readonly<Record<string, number>>;
  sourceLock: Readonly<Record<string, Observation>>;
  requests?: readonly ProductRequest[] | undefined;
}

const countBy = (values: readonly string[]) =>
  Object.fromEntries(
    [...new Set(values)].sort(compareText).map((value) => [value, values.filter((s) => s === value).length]),
  );

function summarize(rules: readonly RegistryV2Rule[], asOf: string, states: ReadonlyMap<string, SourceHealth>) {
  const urls = [...new Set(rules.flatMap((rule) => rule.sources.map(({ url }) => url)))];
  const ages = rules
    .flatMap(({ provenance }) =>
      isIsoDate(provenance.reviewedAt) && provenance.reviewedAt <= asOf
        ? [(Date.parse(asOf) - Date.parse(provenance.reviewedAt)) / 86_400_000]
        : [],
    )
    .sort((a, b) => a - b);
  const middle = Math.floor(ages.length / 2);
  const medianReviewDays = !ages.length
    ? null
    : ages.length % 2
      ? ages[middle]!
      : (ages[middle - 1]! + ages[middle]!) / 2;
  return {
    components: new Set(rules.map(({ purl }) => purlIdentity(purl))).size,
    rules: rules.length,
    byEvent: countBy(rules.map(({ event }) => event)),
    futureDated: rules.filter(({ deadline }) => deadline !== undefined && isIsoDate(deadline) && deadline > asOf)
      .length,
    byConfidence: countBy(rules.map(confidenceOf)),
    medianReviewDays,
    reviewsWithDates: ages.length,
    sources: urls.length,
    bySourceStatus: countBy(urls.map((url) => states.get(url)?.status ?? "unknown")),
    archivedSources: urls.filter((url) => states.get(url)?.archived).length,
  };
}

export function buildCoverage(input: Inputs) {
  const { asOf, dataVersion, rules } = input;
  const week = weekOf(asOf);
  const states = new Map<string, SourceHealth>();
  for (const rule of rules) {
    for (const source of rule.sources) {
      const observation = input.sourceLock[source.url];
      const valid = !!observation && isIsoDate(observation.checkedAt) && observation.checkedAt <= asOf;
      const archived =
        (source.archiveUrl && (!source.archivedAt || source.archivedAt <= asOf)) ||
        (valid && observation.archiveUrl && (!observation.archivedAt || observation.archivedAt <= asOf));
      states.set(source.url, {
        status: valid ? (observation.status ?? "unknown") : "unknown",
        archived: Boolean(archived) || (states.get(source.url)?.archived ?? false),
      });
    }
  }
  const gaps = buildGaps({
    asOf,
    rules,
    runtimes: input.runtimes,
    freshness: input.freshness,
    sources: states,
    requests: input.requests,
  });
  const totals = summarize(rules, asOf, states);
  const grouped = new Map<string, RegistryV2Rule[]>();
  for (const rule of rules) {
    const group = grouped.get(rule.ecosystem) ?? [];
    group.push(rule);
    grouped.set(rule.ecosystem, group);
  }
  const ecosystems = [...grouped]
    .sort(([a], [b]) => compareText(a, b))
    .map(([ecosystem, entries]) => ({ ecosystem, ...summarize(entries, asOf, states) }));
  const headline: CoverageWeek = {
    week,
    asOf,
    dataVersion,
    rules: totals.rules,
    components: totals.components,
    gaps: gaps.entries.length,
    requestsAvailable: gaps.requestsAvailable,
  };
  return {
    headline,
    inputs: { bundleSha256: input.bundleSha256, checkout: input.checkout, sourceLockSha256: input.lockSha256 },
    totals,
    ecosystems,
    gaps,
  };
}

type Coverage = ReturnType<typeof buildCoverage>;
const pairs = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([key, value]) => `${markdownText(key)} ${value}`)
    .join(", ") || "—";

export function renderCoverage(report: Coverage, history: readonly CoverageWeek[]): string {
  const {
    headline: { week, asOf, dataVersion, rules, components, gaps, requestsAvailable },
    totals,
  } = report;
  const lines = [
    `Week of ${week} · Reference date ${asOf} UTC · [Signed data ${dataVersion}](https://github.com/velella-sh/ebb/releases/tag/data-v${dataVersion})`,
    "",
    `**${rules} rules · ${components} components · ${gaps} recorded gaps**`,
    "",
    `Evidence comprises ${totals.sources} unique primary URLs. Archived evidence was recorded for ${totals.archivedSources} of them. ${totals.reviewsWithDates} rules have a dated review at this reference date.`,
    "",
    ...gapKinds
      .filter((kind) => kind !== "requested-product" || requestsAvailable)
      .map((kind) => `- ${kind}: ${report.gaps.entries.filter((entry) => entry.kind === kind).length}`),
    "",
    ...(requestsAvailable ? [] : ["Open product requests were unavailable for this build.", ""]),
    `Source lock SHA-256 \`${report.inputs.sourceLockSha256}\`. [Coverage inputs at this checkout](https://github.com/velella-sh/ebb/tree/${report.inputs.checkout}/tools/coverage/expected).`,
    "",
    "## Ecosystems",
    "",
    "| Ecosystem | Components | Rules | Events | Future dated | Confidence | Median review days (dated rules) | Source statuses | Archived URLs / primary URLs |",
    "| --- | ---: | ---: | --- | ---: | --- | --- | --- | ---: |",
    ...report.ecosystems.map(
      (row) =>
        `| ${markdownText(row.ecosystem)} | ${row.components} | ${row.rules} | ${pairs(row.byEvent)} | ${row.futureDated} | ${pairs(row.byConfidence)} | ${row.medianReviewDays ?? "—"} (${row.reviewsWithDates}) | ${pairs(row.bySourceStatus)} | ${row.archivedSources} / ${row.sources} |`,
    ),
    "",
    "## Recorded weekly trend",
    "",
    "| Week (UTC) | Data version | Rules | Components | Recorded gaps | Product requests |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...history.map(
      (row) =>
        `| ${row.week} | ${row.dataVersion} | ${row.rules} | ${row.components} | ${row.gaps} | ${row.requestsAvailable ? "Included" : "Unavailable"} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

const jsonify = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function loadCoverageInputs(
  input: SiteReleaseInput,
  asOf: string,
  root: string,
  checkout: string,
  requestsFile?: string,
): Promise<Inputs> {
  const [rules, log, bundle, lock, runtimes] = await Promise.all([
    readSiteRelease(input),
    readSiteReleaseLog(input),
    readFile(input.bundlePath),
    readFile(join(root, "registry/sources.lock.json")),
    loadExpectedRuntimes(),
  ]);
  if (sha(bundle) !== input.sha256 || !log.at(-1) || log.at(-1)!.createdAt.slice(0, 10) > asOf) {
    throw new Error("Coverage needs explicitly pinned, signed data no later than the UTC reference date.");
  }
  // The second read uses the same verified digest. Each signed registry carries its own review window.
  const verified = JSON.parse(bundle.toString()) as {
    files: Record<string, { ecosystem?: string; freshness?: { maxReviewAgeDays?: number } }>;
  };
  const freshness = Object.fromEntries(
    Object.entries(verified.files)
      .filter(([path, file]) => path.startsWith("registry/") && file.ecosystem !== undefined)
      .map(([, file]) => [file.ecosystem!, file.freshness?.maxReviewAgeDays ?? DEFAULT_MAX_REVIEW_AGE_DAYS]),
  );
  const sourceLock = JSON.parse(lock.toString()) as { schemaVersion: string; sources: Record<string, Observation> };
  if (sourceLock.schemaVersion !== SOURCE_LOCK_SCHEMA || !sourceLock.sources)
    throw new Error("Invalid source lock for coverage.");
  const requests = requestsFile ? (JSON.parse(await readFile(requestsFile, "utf8")) as ProductRequest[]) : undefined;
  if (
    requests !== undefined &&
    (!Array.isArray(requests) ||
      requests.some(
        (issue) =>
          !issue ||
          !Number.isSafeInteger(issue.number) ||
          issue.number < 1 ||
          typeof issue.title !== "string" ||
          (typeof issue.body !== "string" && issue.body !== null),
      ))
  )
    throw new Error("Invalid new-product issue snapshot.");
  return {
    asOf,
    dataVersion: input.version,
    bundleSha256: input.sha256,
    checkout,
    lockSha256: sha(lock),
    rules,
    runtimes,
    freshness,
    sourceLock: sourceLock.sources,
    requests,
  };
}

async function replaceBody(path: string, body: string) {
  const original = await readFile(path, "utf8");
  const start = "<!-- coverage:begin -->";
  const end = "<!-- coverage:end -->";
  const startAt = original.indexOf(start);
  const endAt = original.indexOf(end);
  if (startAt === -1 || endAt <= startAt) throw new Error(`Missing generated coverage markers in ${path}.`);
  await writeFile(
    path,
    `${original.slice(0, startAt + start.length)}\n\n${body.trimEnd()}\n\n${original.slice(endAt)}`,
  );
}

async function main(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      "as-of": { type: "string" },
      "data-version": { type: "string" },
      sha256: { type: "string" },
      bundle: { type: "string" },
      signature: { type: "string" },
      checkout: { type: "string" },
      "historical-verifier": { type: "string" },
      requests: { type: "string" },
      "prior-history": { type: "string" },
      out: { type: "string" },
      "write-docs": { type: "boolean" },
    },
  });
  const { "as-of": asOf, "data-version": version, sha256, bundle, signature, checkout, out } = values;
  if (
    !asOf ||
    !isIsoDate(asOf) ||
    !version ||
    !sha256 ||
    !bundle ||
    !signature ||
    !checkout ||
    !/^[a-f0-9]{40}$/u.test(checkout) ||
    !out
  ) {
    throw new Error(
      "Expected --as-of YYYY-MM-DD --data-version VERSION --sha256 SHA256 --bundle FILE --signature FILE --checkout COMMIT --out DIRECTORY.",
    );
  }
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const inputs = await loadCoverageInputs(
    {
      bundlePath: bundle,
      signaturePath: signature,
      version,
      sha256,
      historicalVerifier: version === "2026.11.11" ? values["historical-verifier"] : undefined,
    },
    asOf,
    root,
    checkout,
    values.requests,
  );
  const report = buildCoverage(inputs);
  const history = await loadWeeks([
    join(root, "metrics/coverage"),
    ...(values["prior-history"] ? [values["prior-history"]] : []),
  ]);
  const weeks = await archiveWeeks(join(out, "history"), history, report.headline);
  const [coverage, gaps] = [
    renderCoverage(
      report,
      weeks.filter((item) => item.week <= report.headline.week),
    ),
    renderGaps(report.gaps, asOf, version),
  ];
  const card = renderCoverageCard(report.headline, await readFile(join(root, "docs/brand/mark-light.svg"), "utf8"));
  await Promise.all([
    writeFile(join(out, "coverage-report.json"), jsonify(report)),
    writeFile(join(out, "coverage-report.md"), coverage),
    writeFile(join(out, "gaps.md"), gaps),
    writeFile(join(out, "coverage-card.svg"), card),
  ]);
  if (values["write-docs"]) {
    const docs = join(root, "docs");
    await mkdir(join(docs, "assets"), { recursive: true });
    await Promise.all([
      replaceBody(join(docs, "coverage-report.md"), coverage),
      replaceBody(join(docs, "gaps.md"), gaps),
      writeFile(join(docs, "assets/coverage-card.svg"), card),
    ]);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
