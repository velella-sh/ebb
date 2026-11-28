import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { purlToApiPath } from "../../src/api.js";
import { confidenceOf } from "../../src/confidence.js";
import { verifyReleaseLog } from "../../src/data-release-log.js";
import { defaultCacheDirectory } from "../../src/data-source.js";
import { compareBundleVersions } from "../../src/data-update.js";
import { supportedVersions } from "../../src/pick-version.js";
import type { PredictionTable } from "../../src/predict.js";
import { parsePurl, purlIdentity } from "../../src/purl.js";
import type { RegistryV2, RegistryV2Rule, ReplacementItem } from "../../src/registry.js";
import { sourcesOf } from "../../src/sources-of.js";
import { writeCalendars } from "./calendar.js";
import { readEolDateIds, writeEolDateApi } from "./eoldate.js";
import { generateOpenApi } from "./openapi.js";
import { writeRenovateFeeds } from "./renovate.js";

export const API_SCHEMA_VERSION = "ebb.api.v1" as const;

export interface GenerateStaticApiOptions {
  /** Root directory of the ebb repository. Defaults to process.cwd(). */
  root?: string | undefined;
  /** Output directory where static JSON files will be written. */
  outDir: string;
  /** Output for the separate endoflife.date compatibility API. */
  eolCompatOutDir?: string | undefined;
  /** Public base URL for the API. Defaults to "https://velella.sh/ebb/api/v1". */
  baseUrl?: string | undefined;
  /** Deterministic creation timestamp. Defaults to latest date from the data. */
  createdAt?: string | undefined;
  /** Path to the latest source check report. If omitted or not found, source status fields are left out. */
  reportPath?: string | undefined;
  /** Explicit path to a data release log. If omitted, checks standard repository and cache paths. */
  releaseLogPath?: string | undefined;
  /** Size budget for search-index gzip before splitting (bytes). Defaults to 25KB (25600 bytes). */
  searchBudget?: number | undefined;
}

export interface GenerateStaticApiResult {
  outDir: string;
  componentCount: number;
  ecosystemCount: number;
  ruleCount: number;
  allRawBytes: number;
  allGzipBytes: number;
  indexRawBytes: number;
  indexGzipBytes: number;
  searchRawBytes: number;
  searchGzipBytes: number;
  metaRawBytes?: number;
  renovateFeedCount?: number;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Recursively sorts object keys alphabetically to ensure deterministic JSON serialization. */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortKeys) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }
  return value;
}

export async function generateStaticApi(options: GenerateStaticApiOptions): Promise<GenerateStaticApiResult> {
  const root = resolve(options.root ?? ".");
  const outDir = resolve(options.outDir);
  let baseUrl = options.baseUrl ?? "https://velella.sh/ebb/api/v1";
  while (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Read package.json version
  const pkgJsonPath = join(root, "package.json");
  const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf8")) as { version: string };
  const version = pkgJson.version;

  // Read optional source-check report
  const reportPath = options.reportPath ?? join(root, "source-report.json");
  let reportCheckedAt: string | undefined;
  const ruleStatusMap = new Map<string, string>();
  try {
    const rawReport = await readFile(reportPath, "utf8");
    const reportData = JSON.parse(rawReport) as {
      checkedAt?: string;
      stale?: Array<{ ruleId: string }>;
      unreachable?: Array<{ ruleIds: string[] }>;
      changed?: Array<{ ruleIds: string[] }>;
      blocked?: Array<{ ruleIds: string[] }>;
      unrecorded?: Array<{ ruleIds: string[] }>;
      "date-missing"?: Array<{ ruleIds: string[] }>;
      "date-changed"?: Array<{ ruleIds: string[] }>;
      "archived-only"?: Array<{ ruleIds: string[] }>;
    };
    if (reportData.checkedAt) {
      reportCheckedAt = reportData.checkedAt.slice(0, 10);
      for (const entry of reportData.unreachable ?? []) {
        for (const id of entry.ruleIds) ruleStatusMap.set(id, "unreachable");
      }
      for (const entry of reportData["archived-only"] ?? []) {
        for (const id of entry.ruleIds) if (!ruleStatusMap.has(id)) ruleStatusMap.set(id, "archived-only");
      }
      for (const entry of reportData["date-changed"] ?? []) {
        for (const id of entry.ruleIds) if (!ruleStatusMap.has(id)) ruleStatusMap.set(id, "date-changed");
      }
      for (const entry of reportData["date-missing"] ?? []) {
        for (const id of entry.ruleIds) if (!ruleStatusMap.has(id)) ruleStatusMap.set(id, "date-missing");
      }
      for (const entry of reportData.changed ?? []) {
        for (const id of entry.ruleIds) if (!ruleStatusMap.has(id)) ruleStatusMap.set(id, "changed");
      }
      for (const entry of reportData.blocked ?? []) {
        for (const id of entry.ruleIds) if (!ruleStatusMap.has(id)) ruleStatusMap.set(id, "blocked");
      }
      for (const entry of reportData.unrecorded ?? []) {
        for (const id of entry.ruleIds) if (!ruleStatusMap.has(id)) ruleStatusMap.set(id, "unrecorded");
      }
      for (const entry of reportData.stale ?? []) {
        if (!ruleStatusMap.has(entry.ruleId)) ruleStatusMap.set(entry.ruleId, "stale");
      }
    }
  } catch {
    // Missing report is allowed - do not fail the site build
    reportCheckedAt = undefined;
  }

  const formatRule = (rule: RegistryV2Rule): RegistryV2Rule => {
    const confidence = confidenceOf(rule);
    const updated: RegistryV2Rule = {
      ...rule,
      confidence,
      url: `${baseUrl}/rules/${encodeURIComponent(rule.id)}.json`,
    };
    if (reportCheckedAt) {
      updated.sourceCheckedAt = reportCheckedAt;
      updated.sourceStatus = ruleStatusMap.get(rule.id) ?? "ok";
    }
    return updated;
  };

  // Read all registry files
  const registryDir = join(root, "registry");
  const registryEntries = await readdir(registryDir);
  const registryFiles = registryEntries
    .filter((f) => f.endsWith(".json") && !f.includes("sources.lock") && !f.includes("github-actions-shas"))
    .sort();

  const allRules: RegistryV2Rule[] = [];
  const rulesByEcosystem = new Map<string, RegistryV2Rule[]>();
  const rulesByComponent = new Map<
    string,
    {
      purl: string;
      ecosystems: Set<string>;
      rules: RegistryV2Rule[];
    }
  >();

  for (const file of registryFiles) {
    const raw = await readFile(join(registryDir, file), "utf8");
    const reg = JSON.parse(raw) as RegistryV2;
    const eco = reg.ecosystem ?? file.replace(".json", "");

    if (!rulesByEcosystem.has(eco)) {
      rulesByEcosystem.set(eco, []);
    }
    const ecoRules = rulesByEcosystem.get(eco)!;

    for (const rule of reg.rules) {
      const formatted = formatRule(rule);
      allRules.push(formatted);
      ecoRules.push(formatted);

      const identity = purlIdentity(rule.purl);
      let comp = rulesByComponent.get(identity);
      if (!comp) {
        comp = {
          purl: identity,
          ecosystems: new Set<string>(),
          rules: [],
        };
        rulesByComponent.set(identity, comp);
      }
      comp.ecosystems.add(eco);
      comp.rules.push(formatted);
    }
  }

  // Derive dates deterministically from the data, not the clock
  let maxDataDate = "1970-01-01";
  for (const rule of allRules) {
    const d = rule.provenance?.reviewedAt ?? rule.provenance?.observedAt;
    if (d && d > maxDataDate) {
      maxDataDate = d;
    }
  }
  const createdAt = options.createdAt ?? `${maxDataDate}T00:00:00.000Z`;
  const createdDate = new Date(createdAt);
  const asOf = createdDate.toISOString().slice(0, 10);
  const dataVersion = maxDataDate.replace(/-/g, ".");

  // Ensure output directory exists
  await mkdir(outDir, { recursive: true });

  // Copy published JSON Schemas to /schemas/
  const schemasDir = join(outDir, "schemas");
  await mkdir(schemasDir, { recursive: true });
  const schemaFilesToCopy = [
    "static-api.v1.schema.json",
    "rule.v2.schema.json",
    "registry.v2.schema.json",
    "result.v1.schema.json",
    "prediction.v1.schema.json",
    "compat.v1.schema.json",
    "image-variants.v1.schema.json",
    "codenames.v1.schema.json",
  ];
  for (const schemaFile of schemaFilesToCopy) {
    try {
      const content = await readFile(join(root, "schemas", schemaFile), "utf8");
      await writeFile(join(schemasDir, schemaFile), content, "utf8");
    } catch {
      // Ignore if missing in tests
    }
  }

  const tablesDir = join(root, "registry", "tables");
  if (existsSync(tablesDir)) {
    const tables = (await readdir(tablesDir, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.endsWith(".compat.json"),
    );
    if (tables.length) {
      const compatDir = join(outDir, "compat");
      await mkdir(compatDir, { recursive: true });
      for (const { name } of tables) {
        await copyFile(join(tablesDir, name), join(compatDir, name.replace(/\.compat\.json$/, ".json")));
      }
    }
  }

  const imageTableEntries = await Promise.all(
    (["image-variants", "codenames"] as const).map(async (name) => {
      const path = `${name}.json`;
      const source = join(tablesDir, path);
      if (!existsSync(source)) return [];
      const bytes = await readFile(source);
      await writeFile(join(outDir, path), bytes);
      return [[name === "image-variants" ? "imageVariants" : name, { path, sha256: sha256Hex(bytes) }]] as const;
    }),
  );

  const calendarFeeds = await writeCalendars({
    outDir,
    rules: allRules,
    ecosystems: [...rulesByEcosystem.keys()],
    baseUrl,
    createdAt,
  });

  const renovateResult = await writeRenovateFeeds({
    outDir,
    rules: allRules,
    baseUrl,
    createdAt,
  });
  const renovateFeeds = renovateResult.feeds;

  if (options.eolCompatOutDir) {
    await writeEolDateApi({
      outDir: resolve(options.eolCompatOutDir),
      baseUrl,
      rules: allRules,
      ids: await readEolDateIds(root),
      createdAt,
    });
  }

  const schemaUrl = `${baseUrl}/schemas/static-api.v1.schema.json`;

  // 1. Generate Component JSON files
  const indexComponents: Record<
    string,
    {
      purl: string;
      type: string;
      name: string;
      namespace?: string | undefined;
      path: string;
      url: string;
      ecosystems: string[];
      events: string[];
      rules: number;
      earliestDeadline?: string | undefined;
      latestReview?: string | undefined;
      renovate?: string | undefined;
      sha256: string;
      etag: string;
      bytes: number;
    }
  > = {};

  const nameSearchItems: Array<{ name: string; purl: string; path: string }> = [];

  const sortedComponentEntries = [...rulesByComponent.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [purl, comp] of sortedComponentEntries) {
    const relPath = purlToApiPath(purl);
    const parsed = purl.startsWith("pkg:") ? parsePurl(purl) : null;
    const type = parsed?.type ?? relPath.split("/")[0] ?? "unknown";
    const name = parsed?.name ?? relPath.split("/").pop()?.replace(".json", "") ?? "";
    const namespace = parsed?.namespace;

    // Sort rules deterministically by id
    comp.rules.sort((a, b) => a.id.localeCompare(b.id));

    // Determine events, deadlines, latest review
    const events = Array.from(new Set(comp.rules.map((r) => r.event))).sort();
    const deadlines = comp.rules.map((r) => r.deadline).filter((d): d is string => Boolean(d));
    const earliestDeadline = deadlines.length > 0 ? deadlines.sort()[0] : undefined;

    const reviews = comp.rules
      .map((r) => r.provenance?.reviewedAt ?? r.provenance?.observedAt)
      .filter((d): d is string => Boolean(d));
    const latestReview = reviews.length > 0 ? reviews.sort().slice(-1)[0] : undefined;

    const calendar = calendarFeeds.get(purl);
    const renovateFeed = renovateFeeds.get(purl);
    const versionReport = supportedVersions(purl, {
      asOf,
      rules: comp.rules,
    });

    const compReplacements: ReplacementItem[] = [];
    const seenReplacements = new Set<string>();
    for (const rule of comp.rules) {
      for (const rep of rule.replacements ?? []) {
        const key = `${rep.purl}::${rep.vers ?? ""}::${rep.name}::${rep.kind}`;
        if (!seenReplacements.has(key)) {
          seenReplacements.add(key);
          compReplacements.push(rep);
        }
      }
    }

    const compDoc = {
      $schema: schemaUrl,
      schemaVersion: API_SCHEMA_VERSION,
      version,
      generatedAt: createdAt,
      purl,
      type,
      name,
      ...(namespace ? { namespace } : {}),
      ecosystems: Array.from(comp.ecosystems).sort(),
      rules: comp.rules,
      ...(compReplacements.length > 0 ? { replacements: compReplacements } : {}),
      versions: {
        asOf: versionReport.asOf,
        complete: versionReport.complete,
        reason: versionReport.reason,
        recommendation: versionReport.recommendation,
        notes: versionReport.notes,
        lines: versionReport.lines,
      },
      ...(calendar ? { calendar } : {}),
      ...(renovateFeed ? { renovate: renovateFeed.url } : {}),
    };

    const compJson = JSON.stringify(sortKeys(compDoc), null, 2);
    const compBytes = Buffer.byteLength(compJson, "utf8");
    const compHash = sha256Hex(compJson);

    const fullFilePath = join(outDir, relPath);
    await mkdir(dirname(fullFilePath), { recursive: true });
    await writeFile(fullFilePath, compJson, "utf8");

    // Also support percent-encoded alias if namespace contains @ (e.g. %40angular)
    if (relPath.includes("/@")) {
      const encodedRelPath = relPath.replace("/@", "/%40");
      const encodedFilePath = join(outDir, encodedRelPath);
      await mkdir(dirname(encodedFilePath), { recursive: true });
      await writeFile(encodedFilePath, compJson, "utf8");
    }

    indexComponents[purl] = {
      purl,
      type,
      name,
      ...(namespace ? { namespace } : {}),
      path: relPath,
      url: `${baseUrl}/${relPath}`,
      ecosystems: Array.from(comp.ecosystems).sort(),
      events,
      rules: comp.rules.length,
      ...(earliestDeadline ? { earliestDeadline } : {}),
      ...(latestReview ? { latestReview } : {}),
      ...(renovateFeed ? { renovate: renovateFeed.path } : {}),
      sha256: compHash,
      etag: `"${compHash.slice(0, 16)}"`,
      bytes: compBytes,
    };

    nameSearchItems.push({ name, purl, path: relPath });
  }

  // 2. Generate Ecosystem JSON files
  const ecosystemsSummary: Array<{
    name: string;
    path: string;
    url: string;
    rulesCount: number;
    componentsCount: number;
    provenance: {
      methods: { manual: number; imported: number; upstream: number };
      reviewersCount: number;
    };
  }> = [];

  for (const [ecoName, ecoRules] of rulesByEcosystem.entries()) {
    ecoRules.sort((a, b) => a.id.localeCompare(b.id));
    const ecoComponents = new Set(ecoRules.map((r) => purlIdentity(r.purl)));
    const methods = { manual: 0, imported: 0, upstream: 0 };
    const reviewersSet = new Set<string>();
    for (const r of ecoRules) {
      const m = r.provenance?.method ?? (r.provenance?.importer ? "imported" : "manual");
      if (m in methods) methods[m as keyof typeof methods]++;
      if (r.provenance?.reviewer) reviewersSet.add(r.provenance.reviewer);
      if (r.provenance?.reviewers) {
        for (const rev of r.provenance.reviewers) reviewersSet.add(rev);
      }
    }
    const provenanceSummary = {
      methods,
      reviewersCount: reviewersSet.size,
    };

    const ecoDoc = {
      $schema: schemaUrl,
      schemaVersion: API_SCHEMA_VERSION,
      version,
      generatedAt: createdAt,
      ecosystem: ecoName,
      rulesCount: ecoRules.length,
      componentsCount: ecoComponents.size,
      provenance: provenanceSummary,
      rules: ecoRules,
    };

    const ecoJson = JSON.stringify(sortKeys(ecoDoc), null, 2);
    await writeFile(join(outDir, `${ecoName}.json`), ecoJson, "utf8");

    // Also in ecosystems/ subdirectory
    const ecoSubdir = join(outDir, "ecosystems");
    await mkdir(ecoSubdir, { recursive: true });
    await writeFile(join(ecoSubdir, `${ecoName}.json`), ecoJson, "utf8");

    ecosystemsSummary.push({
      name: ecoName,
      path: `${ecoName}.json`,
      url: `${baseUrl}/${ecoName}.json`,
      rulesCount: ecoRules.length,
      componentsCount: ecoComponents.size,
      provenance: provenanceSummary,
    });
  }
  ecosystemsSummary.sort((a, b) => a.name.localeCompare(b.name));

  // 3. Generate ecosystems.json index
  const ecosystemsDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    ecosystemsCount: ecosystemsSummary.length,
    ecosystems: ecosystemsSummary,
  };
  await writeFile(join(outDir, "ecosystems.json"), JSON.stringify(sortKeys(ecosystemsDoc), null, 2), "utf8");

  // 4. Generate all.json and compute its gzip size
  const sortedAllRules = [...allRules].sort((a, b) => a.id.localeCompare(b.id));
  const allDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    rulesCount: sortedAllRules.length,
    componentsCount: rulesByComponent.size,
    ecosystemsCount: rulesByEcosystem.size,
    rules: sortedAllRules,
  };
  const allJson = JSON.stringify(sortKeys(allDoc), null, 2);
  const allGzip = gzipSync(Buffer.from(allJson, "utf8"));
  const allWithGzip = {
    ...sortKeys(allDoc),
    rawBytes: Buffer.byteLength(allJson, "utf8"),
    gzipBytes: allGzip.length,
  };
  const finalAllJson = JSON.stringify(sortKeys(allWithGzip), null, 2);
  await writeFile(join(outDir, "all.json"), finalAllJson, "utf8");

  // 5. Generate index.json
  let latestReviewDate = "1970-01-01";
  for (const rule of allRules) {
    const rev = rule.provenance?.reviewedAt;
    if (rev && rev > latestReviewDate) {
      latestReviewDate = rev;
    }
  }
  const reviewedTime = Date.parse(`${latestReviewDate}T00:00:00Z`);
  const ageDays = Number.isNaN(reviewedTime)
    ? 0
    : Math.max(0, Math.floor((createdDate.getTime() - reviewedTime) / (24 * 60 * 60 * 1000)));
  const stale = ageDays > 30;

  const predictionPath = join(root, "registry/tables/predictions.json");
  let predictionIndex: { path: string; sha256: string; dataVersion: string } | undefined;
  if (existsSync(predictionPath)) {
    const bytes = await readFile(predictionPath);
    const { dataVersion } = JSON.parse(bytes.toString("utf8")) as PredictionTable;
    predictionIndex = { path: "predictions.json", sha256: sha256Hex(bytes), dataVersion };
    await writeFile(join(outDir, predictionIndex.path), bytes);
  }

  const indexDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    rulesCount: allRules.length,
    componentsCount: rulesByComponent.size,
    ecosystemsCount: rulesByEcosystem.size,
    freshness: {
      reviewedThrough: latestReviewDate,
      ageDays,
      stale,
      staleAfterDays: 30,
    },
    components: indexComponents,
    ...(predictionIndex ? { predictions: predictionIndex } : {}),
    ...Object.fromEntries(imageTableEntries.flat()),
  };
  const indexJson = JSON.stringify(sortKeys(indexDoc), null, 2);
  const indexGzip = gzipSync(Buffer.from(indexJson, "utf8"));
  await writeFile(join(outDir, "index.json"), indexJson, "utf8");

  // 6. Generate upcoming.json
  const upcomingRules: Array<{
    ruleId: string;
    purl: string;
    ecosystem: string;
    event: string;
    title: string;
    deadline?: string | undefined;
    severity?: string | undefined;
    replacement?: string | undefined;
    path: string;
  }> = [];

  for (const rule of allRules) {
    if (rule.deadline || rule.event === "scheduled-end-of-life") {
      upcomingRules.push({
        ruleId: rule.id,
        purl: rule.purl,
        ecosystem: rule.ecosystem,
        event: rule.event,
        title: rule.title,
        ...(rule.deadline ? { deadline: rule.deadline } : {}),
        ...(rule.severity ? { severity: rule.severity } : {}),
        ...(rule.replacement ? { replacement: rule.replacement } : {}),
        path: purlToApiPath(rule.purl),
      });
    }
  }
  // Sort by deadline ascending, then ruleId
  upcomingRules.sort((a, b) => {
    const da = a.deadline ?? "9999-99-99";
    const db = b.deadline ?? "9999-99-99";
    const cmp = da.localeCompare(db);
    return cmp !== 0 ? cmp : a.ruleId.localeCompare(b.ruleId);
  });

  const upcomingDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    count: upcomingRules.length,
    upcoming: upcomingRules,
  };
  await writeFile(join(outDir, "upcoming.json"), JSON.stringify(sortKeys(upcomingDoc), null, 2), "utf8");

  // 7. Generate recent.json
  const recentRules: Array<{
    ruleId: string;
    purl: string;
    ecosystem: string;
    event: string;
    title: string;
    deadline?: string | undefined;
    reviewedAt?: string | undefined;
    observedAt?: string | undefined;
    severity?: string | undefined;
    path: string;
  }> = [];

  for (const rule of allRules) {
    if (rule.provenance?.reviewedAt || rule.provenance?.observedAt) {
      recentRules.push({
        ruleId: rule.id,
        purl: rule.purl,
        ecosystem: rule.ecosystem,
        event: rule.event,
        title: rule.title,
        ...(rule.deadline ? { deadline: rule.deadline } : {}),
        ...(rule.provenance?.reviewedAt ? { reviewedAt: rule.provenance.reviewedAt } : {}),
        ...(rule.provenance?.observedAt ? { observedAt: rule.provenance.observedAt } : {}),
        ...(rule.severity ? { severity: rule.severity } : {}),
        path: purlToApiPath(rule.purl),
      });
    }
  }
  // Sort by reviewedAt descending, then ruleId
  recentRules.sort((a, b) => {
    const da = a.reviewedAt ?? a.observedAt ?? "0000-00-00";
    const db = b.reviewedAt ?? b.observedAt ?? "0000-00-00";
    const cmp = db.localeCompare(da);
    return cmp !== 0 ? cmp : a.ruleId.localeCompare(b.ruleId);
  });

  const recentDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    count: recentRules.length,
    recent: recentRules,
  };
  await writeFile(join(outDir, "recent.json"), JSON.stringify(sortKeys(recentDoc), null, 2), "utf8");

  // 7b. Generate releases.json (Sub-issue 5)
  const changelogPath = join(root, "DATA-CHANGELOG.md");
  const changelogCounts: Record<string, { added: number; changed: number; removed: number }> = {};
  if (existsSync(changelogPath)) {
    try {
      const changelogText = await readFile(changelogPath, "utf8");
      const sectionRegex =
        /##\s+\[([a-zA-Z0-9.-]+)\][\s\S]*?(?:- \*\*Added:\*\*\s+(\d+))?[\s\S]*?(?:- \*\*Changed:\*\*\s+(\d+))?[\s\S]*?(?:- \*\*Removed:\*\*\s+(\d+))?/g;
      let m: RegExpExecArray | null;
      while ((m = sectionRegex.exec(changelogText)) !== null) {
        if (m[1]) {
          changelogCounts[m[1]] = {
            added: m[2] ? Number.parseInt(m[2], 10) : 0,
            changed: m[3] ? Number.parseInt(m[3], 10) : 0,
            removed: m[4] ? Number.parseInt(m[4], 10) : 0,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  const logCandidates = [
    options.releaseLogPath,
    join(root, "release-log.jsonl"),
    join(root, "data", "release-log.jsonl"),
    join(defaultCacheDirectory(), "data", "release-log.jsonl"),
  ].filter((p): p is string => Boolean(p && existsSync(p)));

  const releasesList: Array<{
    version: string;
    date: string;
    digest: string;
    counts: { added: number; changed: number; removed: number };
    url: string;
  }> = [];

  if (logCandidates.length > 0) {
    try {
      const logText = await readFile(logCandidates[0]!, "utf8");
      if (logText.trim()) {
        const entries = verifyReleaseLog(logText);
        for (const e of entries) {
          const counts = changelogCounts[e.version] ?? { added: 0, changed: 0, removed: 0 };
          releasesList.push({
            version: e.version,
            date: e.createdAt.slice(0, 10),
            digest: e.contentDigest,
            counts,
            url: `https://github.com/velella-sh/ebb/releases/tag/data-v${e.version}`,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  releasesList.sort((a, b) => compareBundleVersions(b.version, a.version));

  const releasesDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    count: releasesList.length,
    releases: releasesList,
  };
  await writeFile(join(outDir, "releases.json"), JSON.stringify(sortKeys(releasesDoc), null, 2), "utf8");

  // 8. Generate search-index.json (prefix search index) with budget check and splitting
  const searchBudget = options.searchBudget ?? 25 * 1024;
  nameSearchItems.sort((a, b) => a.name.localeCompare(b.name) || a.purl.localeCompare(b.purl));

  const prefixes: Record<string, number[]> = {};
  for (let idx = 0; idx < nameSearchItems.length; idx++) {
    const item = nameSearchItems[idx];
    if (!item) continue;
    const lowerName = item.name.toLowerCase();
    for (let len = 2; len <= Math.min(lowerName.length, 6); len++) {
      const prefix = lowerName.slice(0, len);
      if (!prefixes[prefix]) {
        prefixes[prefix] = [];
      }
      const list = prefixes[prefix];
      if (list && !list.includes(idx)) {
        list.push(idx);
      }
    }
  }
  for (const prefix of Object.keys(prefixes)) {
    prefixes[prefix]?.sort((a, b) => a - b);
  }

  const searchDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    items: nameSearchItems,
    prefixes,
  };
  const searchJson = JSON.stringify(sortKeys(searchDoc));
  const searchGzip = gzipSync(Buffer.from(searchJson, "utf8"));

  if (searchGzip.length > searchBudget) {
    // Split search index by first letter when exceeding budget
    const splitDir = join(outDir, "search-index");
    await mkdir(splitDir, { recursive: true });
    const partitions: Record<string, typeof nameSearchItems> = {};
    for (const item of nameSearchItems) {
      const letter = (item.name[0] ?? "_").toLowerCase();
      if (!partitions[letter]) partitions[letter] = [];
      partitions[letter].push(item);
    }

    const partitionMap: Record<string, string> = {};
    for (const [letter, group] of Object.entries(partitions).sort(([a], [b]) => a.localeCompare(b))) {
      const partPrefixes: Record<string, number[]> = {};
      for (let idx = 0; idx < group.length; idx++) {
        const item = group[idx];
        if (!item) continue;
        const lowerName = item.name.toLowerCase();
        for (let len = 2; len <= Math.min(lowerName.length, 6); len++) {
          const prefix = lowerName.slice(0, len);
          if (!partPrefixes[prefix]) partPrefixes[prefix] = [];
          const list = partPrefixes[prefix];
          if (list && !list.includes(idx)) list.push(idx);
        }
      }
      for (const p of Object.keys(partPrefixes)) {
        partPrefixes[p]?.sort((a, b) => a - b);
      }
      const partDoc = {
        $schema: schemaUrl,
        schemaVersion: API_SCHEMA_VERSION,
        version,
        generatedAt: createdAt,
        letter,
        items: group,
        prefixes: partPrefixes,
      };
      await writeFile(join(splitDir, `${letter}.json`), JSON.stringify(sortKeys(partDoc)), "utf8");
      partitionMap[letter] = `search-index/${letter}.json`;
    }

    const splitIndexDoc = {
      $schema: schemaUrl,
      schemaVersion: API_SCHEMA_VERSION,
      version,
      generatedAt: createdAt,
      split: true,
      partitions: partitionMap,
    };
    await writeFile(join(outDir, "search-index.json"), JSON.stringify(sortKeys(splitIndexDoc), null, 2), "utf8");
  } else {
    await writeFile(join(outDir, "search-index.json"), searchJson, "utf8");
  }

  // 9. Generate rules/<rule-id>.json files
  const rulesDir = join(outDir, "rules");
  await mkdir(rulesDir, { recursive: true });
  for (const rule of allRules) {
    const encodedId = encodeURIComponent(rule.id);
    const ruleDoc = {
      $schema: schemaUrl,
      schemaVersion: API_SCHEMA_VERSION,
      version,
      generatedAt: createdAt,
      rule,
    };
    const ruleJson = JSON.stringify(sortKeys(ruleDoc), null, 2);
    await writeFile(join(rulesDir, `${encodedId}.json`), ruleJson, "utf8");
    if (encodedId !== rule.id && !rule.id.includes("/")) {
      await writeFile(join(rulesDir, `${rule.id}.json`), ruleJson, "utf8");
    }
  }

  // 10. Generate meta.json (Sub-issue 2) - No dynamic timestamp included
  const metaDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    version,
    dataVersion,
    rulesCount: allRules.length,
    componentsCount: rulesByComponent.size,
    ecosystemsCount: rulesByEcosystem.size,
    schemaVersions: {
      api: API_SCHEMA_VERSION,
      rule: "ebb.rule.v2",
      result: 1,
      registry: "ebb.registry.v2",
    },
  };
  const metaJson = JSON.stringify(sortKeys(metaDoc), null, 2);
  await writeFile(join(outDir, "meta.json"), metaJson, "utf8");

  // 11. Generate openapi.json (Sub-issue 5)
  const openApiDoc = await generateOpenApi({ root, baseUrl, version });
  await writeFile(join(outDir, "openapi.json"), JSON.stringify(sortKeys(openApiDoc), null, 2), "utf8");

  // 12. Generate 404.json for unknown components/rules (Sub-issue 6)
  const notFoundDoc = {
    $schema: schemaUrl,
    schemaVersion: API_SCHEMA_VERSION,
    error: "Not Found",
    message: "Component or rule not found. A 404 does not mean supported; it means Ebb has no lifecycle data for it.",
  };
  await writeFile(join(outDir, "404.json"), JSON.stringify(sortKeys(notFoundDoc), null, 2), "utf8");

  // 13. Generate sources/<rule-id>.json files
  const sourcesDir = join(outDir, "sources");
  await mkdir(sourcesDir, { recursive: true });
  for (const rule of allRules) {
    const res = sourcesOf(rule.id, { rules: allRules });
    const ruleSourcesDoc = {
      $schema: schemaUrl,
      schemaVersion: API_SCHEMA_VERSION,
      version,
      generatedAt: createdAt,
      ...res,
    };
    await writeFile(join(sourcesDir, `${rule.id}.json`), JSON.stringify(sortKeys(ruleSourcesDoc), null, 2), "utf8");
  }

  return {
    outDir,
    componentCount: rulesByComponent.size,
    ecosystemCount: rulesByEcosystem.size,
    ruleCount: allRules.length,
    allRawBytes: Buffer.byteLength(finalAllJson, "utf8"),
    allGzipBytes: allGzip.length,
    indexRawBytes: Buffer.byteLength(indexJson, "utf8"),
    indexGzipBytes: indexGzip.length,
    searchRawBytes: Buffer.byteLength(searchJson, "utf8"),
    searchGzipBytes: searchGzip.length,
    metaRawBytes: Buffer.byteLength(metaJson, "utf8"),
    renovateFeedCount: renovateFeeds.size,
  };
}
