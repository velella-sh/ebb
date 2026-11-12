import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { purlToApiPath } from "../../src/api.js";
import { OFFING_HINT_TEXT } from "../../src/hint.js";
import { parsePurl, purlIdentity } from "../../src/purl.js";
import type { RegistryV2, RegistryV2Rule } from "../../src/registry.js";

export const API_SCHEMA_VERSION = "ebb.api.v1" as const;

export interface GenerateStaticApiOptions {
  /** Root directory of the ebb repository. Defaults to process.cwd(). */
  root?: string | undefined;
  /** Output directory where static JSON files will be written. */
  outDir: string;
  /** Public base URL for the API. Defaults to "https://velella.sh/ebb/api/v1". */
  baseUrl?: string | undefined;
  /** Deterministic creation timestamp. Defaults to current ISO timestamp. */
  createdAt?: string | undefined;
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
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function generateStaticApi(options: GenerateStaticApiOptions): Promise<GenerateStaticApiResult> {
  const root = resolve(options.root ?? ".");
  const outDir = resolve(options.outDir);
  const baseUrl = (options.baseUrl ?? "https://velella.sh/ebb/api/v1").replace(/\/+$/, "");
  const createdAt = options.createdAt ?? new Date().toISOString();

  // Read package.json version
  const pkgJsonPath = join(root, "package.json");
  const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf8")) as { version: string };
  const version = pkgJson.version;

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
      allRules.push(rule);
      ecoRules.push(rule);

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
      comp.rules.push(rule);
    }
  }

  // Ensure output directory exists
  await mkdir(outDir, { recursive: true });

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
      sha256: string;
      etag: string;
      bytes: number;
    }
  > = {};

  const nameSearchItems: Array<{ name: string; purl: string; path: string }> = [];

  for (const [purl, comp] of rulesByComponent.entries()) {
    const relPath = purlToApiPath(purl);
    const parsed = purl.startsWith("pkg:") ? parsePurl(purl) : null;
    const type = parsed?.type ?? relPath.split("/")[0] ?? "unknown";
    const name = parsed?.name ?? relPath.split("/").pop()?.replace(".json", "") ?? "";
    const namespace = parsed?.namespace;

    // Determine events, deadlines, latest review
    const events = Array.from(new Set(comp.rules.map((r) => r.event))).sort();
    const deadlines = comp.rules.map((r) => r.deadline).filter((d): d is string => Boolean(d));
    const earliestDeadline = deadlines.length > 0 ? deadlines.sort()[0] : undefined;

    const reviews = comp.rules
      .map((r) => r.provenance?.reviewedAt ?? r.provenance?.observedAt)
      .filter((d): d is string => Boolean(d));
    const latestReview = reviews.length > 0 ? reviews.sort().slice(-1)[0] : undefined;

    const hasIssue = comp.rules.length > 0;

    const compDoc = {
      schemaVersion: API_SCHEMA_VERSION,
      version,
      generatedAt: createdAt,
      purl,
      type,
      name,
      ...(namespace ? { namespace } : {}),
      ecosystems: Array.from(comp.ecosystems).sort(),
      rules: comp.rules,
      ...(hasIssue ? { hint: OFFING_HINT_TEXT } : {}),
    };

    const compJson = JSON.stringify(compDoc, null, 2);
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
  }> = [];

  for (const [ecoName, ecoRules] of rulesByEcosystem.entries()) {
    const ecoComponents = new Set(ecoRules.map((r) => purlIdentity(r.purl)));
    const ecoDoc = {
      schemaVersion: API_SCHEMA_VERSION,
      version,
      generatedAt: createdAt,
      ecosystem: ecoName,
      rulesCount: ecoRules.length,
      componentsCount: ecoComponents.size,
      rules: ecoRules,
    };

    const ecoJson = JSON.stringify(ecoDoc, null, 2);
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
    });
  }
  ecosystemsSummary.sort((a, b) => a.name.localeCompare(b.name));

  // 3. Generate ecosystems.json index
  const ecosystemsDoc = {
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    ecosystemsCount: ecosystemsSummary.length,
    ecosystems: ecosystemsSummary,
  };
  await writeFile(join(outDir, "ecosystems.json"), JSON.stringify(ecosystemsDoc, null, 2), "utf8");

  // 4. Generate all.json and compute its gzip size
  // Sort rules deterministically by rule id
  const sortedAllRules = [...allRules].sort((a, b) => a.id.localeCompare(b.id));
  const allDoc = {
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    rulesCount: sortedAllRules.length,
    componentsCount: rulesByComponent.size,
    ecosystemsCount: rulesByEcosystem.size,
    rules: sortedAllRules,
  };
  const allJson = JSON.stringify(allDoc, null, 2);
  const allGzip = gzipSync(Buffer.from(allJson, "utf8"));
  const allWithGzip = {
    ...allDoc,
    rawBytes: Buffer.byteLength(allJson, "utf8"),
    gzipBytes: allGzip.length,
  };
  const finalAllJson = JSON.stringify(allWithGzip, null, 2);
  await writeFile(join(outDir, "all.json"), finalAllJson, "utf8");

  // 5. Generate index.json
  const indexDoc = {
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    rulesCount: allRules.length,
    componentsCount: rulesByComponent.size,
    ecosystemsCount: rulesByEcosystem.size,
    components: indexComponents,
  };
  const indexJson = JSON.stringify(indexDoc, null, 2);
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
  // Sort by deadline ascending
  upcomingRules.sort((a, b) => {
    const da = a.deadline ?? "9999-99-99";
    const db = b.deadline ?? "9999-99-99";
    return da.localeCompare(db);
  });

  const upcomingDoc = {
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    count: upcomingRules.length,
    upcoming: upcomingRules,
  };
  await writeFile(join(outDir, "upcoming.json"), JSON.stringify(upcomingDoc, null, 2), "utf8");

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
  // Sort by reviewedAt descending
  recentRules.sort((a, b) => {
    const da = a.reviewedAt ?? a.observedAt ?? "0000-00-00";
    const db = b.reviewedAt ?? b.observedAt ?? "0000-00-00";
    return db.localeCompare(da);
  });

  const recentDoc = {
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    count: recentRules.length,
    recent: recentRules,
  };
  await writeFile(join(outDir, "recent.json"), JSON.stringify(recentDoc, null, 2), "utf8");

  // 8. Generate search-index.json (prefix search index)
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

  const searchDoc = {
    schemaVersion: API_SCHEMA_VERSION,
    version,
    generatedAt: createdAt,
    items: nameSearchItems,
    prefixes,
  };
  const searchJson = JSON.stringify(searchDoc);
  const searchGzip = gzipSync(Buffer.from(searchJson, "utf8"));
  await writeFile(join(outDir, "search-index.json"), searchJson, "utf8");

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
  };
}
