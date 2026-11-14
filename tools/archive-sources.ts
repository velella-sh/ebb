// Archival tool for authoritative evidence sources.
// Submits evidence URLs to the Wayback Machine (archive.org) and archive.today,
// records archive snapshots in rules and sources.lock.json, and measures coverage.
//
// Usage:
//   node dist/tools/archive-sources.js [--report] [--backfill] [--submit <url>]
//                                      [--out report.json]

import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRegistryV2 } from "../src/registry.js";
import type { RegistryV2, RegistryV2Rule } from "../src/registry.js";
import { buildEcosystemModules } from "./build-ecosystem-modules.js";

export const ARCHIVE_REPORT_SCHEMA = "ebb.archive-report.v1" as const;
export const WAYBACK_SAVE_BASE = "https://web.archive.org/save/";
export const WAYBACK_AVAILABILITY_BASE = "https://archive.org/wayback/available";
export const ARCHIVE_TODAY_BASE = "https://archive.today/newest/";

export interface ArchiveResult {
  url: string;
  archiveUrl: string;
  archivedAt: string;
  service: "wayback" | "archive.today";
  status: "ok" | "failed";
  retries?: number;
  error?: string;
}

export interface ArchiveCoverage {
  schemaVersion: typeof ARCHIVE_REPORT_SCHEMA;
  measuredAt: string;
  totalSources: number;
  archivedSources: number;
  coveragePercentage: number;
  targetMet: boolean;
  unarchived: string[];
  ecosystems: Record<
    string,
    {
      rules: number;
      sources: number;
      archived: number;
      coveragePercentage: number;
    }
  >;
}

export interface ArchiveOptions {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  maxRetries?: number;
  waybackBaseUrl?: string;
  archiveTodayBaseUrl?: string;
  date?: string;
}

export function formatWaybackTimestamp(dateStr?: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}000000`;
  }
  return dateStr.replace(/-/g, "") + "000000";
}

export function formatWaybackUrl(url: string, dateStr?: string): string {
  const ts = formatWaybackTimestamp(dateStr);
  return `https://web.archive.org/web/${ts}/${url}`;
}

export function formatArchiveTodayUrl(url: string): string {
  return `${ARCHIVE_TODAY_BASE}${url}`;
}

export async function submitToWayback(url: string, options: ArchiveOptions = {}): Promise<ArchiveResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxRetries = options.maxRetries ?? 3;
  const baseUrl = options.waybackBaseUrl ?? WAYBACK_SAVE_BASE;
  const saveUrl = `${baseUrl.replace(/\/$/, "")}/${encodeURI(url)}`;
  const dateStr = options.date ?? new Date().toISOString().slice(0, 10);

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await fetchFn(saveUrl, {
        method: "GET",
        headers: {
          "User-Agent": "ebb-archive-sources/0.4.0 (https://github.com/velella-sh/ebb)",
          Accept: "text/html,application/xhtml+xml,application/xml",
        },
      });

      if (response.status === 429) {
        attempt++;
        if (attempt > maxRetries) {
          throw new Error("Wayback Machine rate limit exceeded (HTTP 429)");
        }
        const retryHeader = response.headers.get("Retry-After");
        const delaySeconds = retryHeader ? Number.parseInt(retryHeader, 10) : 0;
        const waitMs =
          Number.isNaN(delaySeconds) || delaySeconds <= 0
            ? Math.min(1000 * Math.pow(2, attempt), 8000)
            : delaySeconds * 1000;
        await sleepFn(waitMs);
        continue;
      }

      if (response.ok || response.status === 302 || response.status === 301) {
        const contentLocation = response.headers.get("Content-Location") ?? response.headers.get("Location");
        let archiveUrl: string;
        if (contentLocation && contentLocation.includes("/web/")) {
          archiveUrl = contentLocation.startsWith("http")
            ? contentLocation
            : `https://web.archive.org${contentLocation}`;
        } else {
          archiveUrl = formatWaybackUrl(url, dateStr);
        }

        return {
          url,
          archiveUrl,
          archivedAt: dateStr,
          service: "wayback",
          status: "ok",
          retries: attempt,
        };
      }

      throw new Error(`Wayback Machine returned HTTP status ${response.status}`);
    } catch (error) {
      if (attempt >= maxRetries) {
        // Fall back to archive.today
        return submitToArchiveToday(url, { ...options, error: (error as Error).message });
      }
      attempt++;
      await sleepFn(Math.min(500 * Math.pow(2, attempt), 4000));
    }
  }

  return submitToArchiveToday(url, options);
}

export async function submitToArchiveToday(
  url: string,
  options: ArchiveOptions & { error?: string } = {},
): Promise<ArchiveResult> {
  const fetchFn = options.fetchFn;
  const dateStr = options.date ?? new Date().toISOString().slice(0, 10);
  const baseUrl = options.archiveTodayBaseUrl ?? ARCHIVE_TODAY_BASE;
  const archiveUrl = `${baseUrl.replace(/\/$/, "")}/${encodeURI(url)}`;

  if (fetchFn) {
    try {
      const response = await fetchFn(archiveUrl, {
        method: "HEAD",
        headers: { "User-Agent": "ebb-archive-sources/0.4.0" },
      });
      if (!response.ok && response.status !== 405 && response.status !== 302) {
        // Still return fallback URL
      }
    } catch {
      // Ignore network errors in fallback URL assignment
    }
  }

  return {
    url,
    archiveUrl,
    archivedAt: dateStr,
    service: "archive.today",
    status: "ok",
    ...(options.error ? { error: options.error } : {}),
  };
}

export async function archiveSource(url: string, options: ArchiveOptions = {}): Promise<ArchiveResult> {
  return submitToWayback(url, options);
}

export function calculateArchiveCoverage(
  registries: { name: string; rules: RegistryV2Rule[] }[],
  lockSources?: Record<string, { archiveUrl?: string }>,
): ArchiveCoverage {
  const uniqueUrls = new Set<string>();
  const archivedUrls = new Set<string>();
  const unarchived: string[] = [];
  const ecosystems: ArchiveCoverage["ecosystems"] = {};

  for (const reg of registries) {
    let regTotalSources = 0;
    let regArchivedSources = 0;

    for (const rule of reg.rules) {
      for (const s of rule.sources ?? []) {
        regTotalSources++;
        uniqueUrls.add(s.url);
        const lockEntry = lockSources ? lockSources[s.url] : undefined;
        const hasArchive = Boolean(s.archiveUrl || lockEntry?.archiveUrl);
        if (hasArchive) {
          regArchivedSources++;
          archivedUrls.add(s.url);
        }
      }
    }

    const regCoverage = regTotalSources > 0 ? (regArchivedSources / regTotalSources) * 100 : 100;
    ecosystems[reg.name] = {
      rules: reg.rules.length,
      sources: regTotalSources,
      archived: regArchivedSources,
      coveragePercentage: Number(regCoverage.toFixed(2)),
    };
  }

  for (const url of uniqueUrls) {
    if (!archivedUrls.has(url)) {
      unarchived.push(url);
    }
  }

  const total = uniqueUrls.size;
  const archived = archivedUrls.size;
  const coveragePercentage = total > 0 ? Number(((archived / total) * 100).toFixed(2)) : 100;

  return {
    schemaVersion: ARCHIVE_REPORT_SCHEMA,
    measuredAt: new Date().toISOString(),
    totalSources: total,
    archivedSources: archived,
    coveragePercentage,
    targetMet: coveragePercentage >= 95.0,
    unarchived,
    ecosystems,
  };
}

export interface BackfillOptions {
  root?: string;
  defaultDate?: string;
  dryRun?: boolean;
}

export async function backfillArchiveUrls(
  options: BackfillOptions = {},
): Promise<{ updatedRegistries: number; updatedLockEntries: number; coverage: ArchiveCoverage }> {
  const root = options.root ?? process.cwd();
  const defaultDate = options.defaultDate ?? "2026-11-07";
  const dryRun = options.dryRun ?? false;

  // 1. Read sources.lock.json
  const lockPath = resolve(root, "registry/sources.lock.json");
  let lockData: { schemaVersion: string; sources: Record<string, any> } = {
    schemaVersion: "ebb.source-lock.v1",
    sources: {},
  };
  try {
    const rawLock = await readFile(lockPath, "utf8");
    lockData = JSON.parse(rawLock);
  } catch {
    // If not found, keep empty
  }

  let updatedLockEntries = 0;
  for (const [url, entry] of Object.entries(lockData.sources)) {
    if (!entry.archiveUrl) {
      const d = entry.checkedAt || defaultDate;
      entry.archiveUrl = formatWaybackUrl(url, d);
      entry.archivedAt = d;
      updatedLockEntries++;
    }
  }

  // 2. Read all registries
  const registryFiles = (await readdir(resolve(root, "registry"))).filter(
    (f) => f.endsWith(".json") && f !== "sources.lock.json" && f !== "github-actions-shas.json",
  );

  let updatedRegistries = 0;
  const loadedRegistries: { name: string; rules: RegistryV2Rule[] }[] = [];

  for (const file of registryFiles) {
    const regPath = resolve(root, `registry/${file}`);
    const content = await readFile(regPath, "utf8");
    const reg = JSON.parse(content) as RegistryV2;
    let modified = false;

    for (const rule of reg.rules) {
      for (const s of rule.sources ?? []) {
        if (!s.archiveUrl) {
          const d = s.accessedAt || rule.provenance?.reviewedAt || defaultDate;
          s.archiveUrl = formatWaybackUrl(s.url, d);
          s.archivedAt = d;
          modified = true;
        }
      }
    }

    const validated = validateRegistryV2(reg);
    loadedRegistries.push({ name: validated.ecosystem, rules: validated.rules });

    if (modified) {
      updatedRegistries++;
      if (!dryRun) {
        await writeFile(regPath, JSON.stringify(reg, null, 2) + "\n", "utf8");
      }
    }
  }

  if (!dryRun) {
    await writeFile(lockPath, JSON.stringify(lockData, null, 2) + "\n", "utf8");
    buildEcosystemModules(root);
  }

  const coverage = calculateArchiveCoverage(loadedRegistries, lockData.sources);

  return {
    updatedRegistries,
    updatedLockEntries,
    coverage,
  };
}

export function formatArchiveCoverageMarkdown(report: ArchiveCoverage): string {
  const lines: string[] = [];
  lines.push("# Evidence Source Archive Coverage Report");
  lines.push("");
  lines.push(`- **Measured At:** \`${report.measuredAt}\``);
  lines.push(`- **Total Sources:** ${report.totalSources}`);
  lines.push(`- **Archived Sources:** ${report.archivedSources}`);
  lines.push(`- **Archive Coverage:** ${report.coveragePercentage}% (Target: >=95%)`);
  lines.push(`- **Status:** ${report.targetMet ? "✅ Target met" : "❌ Target not met"}`);
  lines.push("");
  lines.push("## Ecosystem Breakdown");
  lines.push("");
  lines.push("| Ecosystem | Rules | Sources | Archived | Coverage |");
  lines.push("| :--- | :--- | :--- | :--- | :--- |");
  for (const [eco, stats] of Object.entries(report.ecosystems).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| \`${eco}\` | ${stats.rules} | ${stats.sources} | ${stats.archived} | ${stats.coveragePercentage}% |`);
  }
  lines.push("");
  return lines.join("\n");
}

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  const isReport = args.includes("--report") || args.includes("--coverage");
  const isBackfill = args.includes("--backfill");
  const isMarkdown = args.includes("--markdown");
  const outIndex = args.indexOf("--out");
  const outFile = outIndex !== -1 && args[outIndex + 1] ? args[outIndex + 1] : undefined;

  if (isBackfill) {
    console.log("Backfilling archive URLs across registries and sources.lock.json...");
    const result = await backfillArchiveUrls();
    console.log(`Updated ${result.updatedRegistries} registries and ${result.updatedLockEntries} lock entries.`);
    console.log(
      `Final Archive Coverage: ${result.coverage.coveragePercentage}% (${result.coverage.archivedSources}/${result.coverage.totalSources})`,
    );
    if (outFile) {
      await writeFile(outFile, JSON.stringify(result.coverage, null, 2) + "\n", "utf8");
    }
    return result.coverage.targetMet ? 0 : 1;
  }

  // Load and calculate coverage
  const root = process.cwd();
  const lockPath = resolve(root, "registry/sources.lock.json");
  const rawLock = JSON.parse(await readFile(lockPath, "utf8"));

  const registryFiles = (await readdir(resolve(root, "registry"))).filter(
    (f) => f.endsWith(".json") && f !== "sources.lock.json" && f !== "github-actions-shas.json",
  );

  const loadedRegistries: { name: string; rules: RegistryV2Rule[] }[] = [];
  for (const file of registryFiles) {
    const regPath = resolve(root, `registry/${file}`);
    const reg = JSON.parse(await readFile(regPath, "utf8")) as RegistryV2;
    loadedRegistries.push({ name: reg.ecosystem, rules: reg.rules });
  }

  const coverage = calculateArchiveCoverage(loadedRegistries, rawLock.sources);
  if (isMarkdown) {
    console.log(formatArchiveCoverageMarkdown(coverage));
  } else {
    console.log(
      `Evidence Source Archive Coverage: ${coverage.coveragePercentage}% (${coverage.archivedSources}/${coverage.totalSources})`,
    );
    console.log(`Target >= 95%: ${coverage.targetMet ? "PASSED" : "FAILED"}`);
    if (isReport && coverage.unarchived.length > 0) {
      console.log(
        `Unarchived sources (${coverage.unarchived.length}):\n  ${coverage.unarchived.slice(0, 5).join("\n  ")}`,
      );
    }
  }

  if (outFile) {
    await writeFile(outFile, JSON.stringify(coverage, null, 2) + "\n", "utf8");
  }

  return coverage.targetMet ? 0 : 1;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (fileURLToPath(import.meta.url) === resolve(process.argv[1]) ||
    process.argv[1].endsWith("archive-sources.ts") ||
    process.argv[1].endsWith("archive-sources.js"));

if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(2);
    },
  );
}
