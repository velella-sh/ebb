/**
 * `sourcesOf(ruleId, options)`: retrieve authoritative evidence sources, archive
 * URLs, health status, and review provenance for a specific lifecycle rule.
 */

import { getDataLoader } from "./data/load.js";
import { BUNDLED_ECOSYSTEMS } from "./data/ecosystems.js";
import { EbbError } from "./errors.js";
import {
  isIsoDate,
  type LifecycleEvent,
  type Provenance,
  type ProvenanceMethod,
  type RegistryV2,
  type RegistryV2Rule,
  validateRegistryV2,
} from "./registry.js";
import type { Severity } from "./domain.js";
import { findPackageFileSync } from "./package-files.js";
import { readFileSync } from "node:fs";

export type SourceHealthStatus = "ok" | "unreachable" | "changed" | "blocked" | "unrecorded" | "unknown";

export interface SourceEntry {
  /** The title or description of the evidence source page. */
  readonly title: string;
  /** Primary canonical URL of the evidence page. */
  readonly url: string;
  /** Date the evidence was last retrieved or verified (YYYY-MM-DD), when recorded. */
  readonly accessedAt?: string | undefined;
  /** Archive snapshot URL (e.g. Wayback Machine), when one exists. */
  readonly archiveUrl?: string | undefined;
  /** Date the archive snapshot was captured (YYYY-MM-DD), when recorded. */
  readonly archivedAt?: string | undefined;
  /** Health status of the source page. */
  readonly health: SourceHealthStatus;
  /** Alias for `health`. */
  readonly status: SourceHealthStatus;
}

export interface SourcesOfOptions {
  /** Reference date (YYYY-MM-DD) for time-travel filtering. Rules observed after this date are hidden. */
  readonly asOf?: string | undefined;
  /** Custom list of rules to inspect instead of reading active registry data. */
  readonly rules?: readonly RegistryV2Rule[] | undefined;
  /** Custom list of registries to inspect instead of reading active registry data. */
  readonly registries?: readonly RegistryV2[] | undefined;
}

export interface SourcesOfResult {
  readonly ruleId: string;
  readonly ecosystem: string;
  readonly purl: string;
  readonly event: LifecycleEvent;
  readonly title: string;
  readonly summary: string;
  readonly severity: Severity;
  readonly reviewer: string;
  readonly reviewedAt: string;
  readonly observedAt: string;
  readonly sources: readonly SourceEntry[];
  readonly deadline?: string | undefined;
  readonly replacement?: string | undefined;
  /** Full provenance metadata if present. */
  readonly provenance?: Provenance | undefined;
  /** Creation/maintenance method (manual, imported, upstream). */
  readonly method?: ProvenanceMethod | undefined;
  /** All reviewers who approved the rule. */
  readonly reviewers?: readonly string[] | undefined;
  /** Importer that drafted the rule, when one did. */
  readonly importer?: string | undefined;
  /** Version of the importer tool that drafted the rule. */
  readonly importerVersion?: string | undefined;
}

interface LockEntry {
  finalUrl?: string;
  title?: string | null;
  checkedAt?: string;
  archiveUrl?: string;
  archivedAt?: string;
  status?: SourceHealthStatus;
}

const registryCache = new Map<string, RegistryV2>();

function bundledRegistry(ecosystem: string): RegistryV2 | undefined {
  const cached = registryCache.get(ecosystem);
  if (cached !== undefined) return cached;
  try {
    const loader = getDataLoader();
    if (typeof loader.readSync === "function") {
      const raw = loader.readSync(`registry/${ecosystem}.json`);
      if (raw && typeof raw === "object") {
        const validated = validateRegistryV2(raw);
        registryCache.set(ecosystem, validated);
        return validated;
      }
    }
  } catch {
    // DataLoader error ignored
  }

  try {
    const filePath = findPackageFileSync(`registry/${ecosystem}.json`, import.meta.url);
    const content = JSON.parse(readFileSync(filePath, "utf8"));
    const validated = validateRegistryV2(content);
    registryCache.set(ecosystem, validated);
    return validated;
  } catch {
    // File not found on disk ignored
  }

  return undefined;
}

let sourcesLock: Record<string, LockEntry> | null | undefined;

function getSourcesLock(): Record<string, LockEntry> | null {
  if (sourcesLock !== undefined) return sourcesLock;
  try {
    const loader = getDataLoader();
    if (typeof loader.readSync === "function") {
      const raw = loader.readSync("registry/sources.lock.json");
      if (raw && typeof raw === "object" && "sources" in raw) {
        sourcesLock = (raw as { sources: Record<string, LockEntry> }).sources;
        return sourcesLock;
      }
    }
  } catch {
    // DataLoader read error ignored
  }

  try {
    const filePath = findPackageFileSync("registry/sources.lock.json", import.meta.url);
    const content = JSON.parse(readFileSync(filePath, "utf8")) as { sources?: Record<string, LockEntry> };
    if (content?.sources) {
      sourcesLock = content.sources;
      return sourcesLock;
    }
  } catch {
    // File not found on disk ignored
  }

  sourcesLock = null;
  return null;
}

function isArchiveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "web.archive.org" ||
      host === "archive.org" ||
      host === "archive.today" ||
      host === "archive.is" ||
      host === "archive.ph" ||
      host === "archive.vn" ||
      host === "archive.md" ||
      host.endsWith(".archive.org")
    );
  } catch {
    return false;
  }
}

function resolveSourceHealth(
  source: Record<string, unknown>,
  lock: Record<string, LockEntry> | null,
): SourceHealthStatus {
  if (typeof source.health === "string") return source.health as SourceHealthStatus;
  if (typeof source.status === "string") return source.status as SourceHealthStatus;
  if (!lock) return "ok";
  const url = typeof source.url === "string" ? source.url : "";
  const entry = lock[url] ?? lock[url.replace(/\/$/, "")] ?? lock[`${url}/`];
  if (entry) {
    return entry.status ?? "ok";
  }
  return "unrecorded";
}

function resolveArchiveUrl(
  source: Record<string, unknown>,
  lock: Record<string, LockEntry> | null,
): string | undefined {
  if (typeof source.archiveUrl === "string" && source.archiveUrl) {
    return source.archiveUrl;
  }
  const url = typeof source.url === "string" ? source.url : "";
  if (lock) {
    const entry = lock[url] ?? lock[url.replace(/\/$/, "")] ?? lock[`${url}/`];
    if (typeof entry?.archiveUrl === "string" && entry.archiveUrl) {
      return entry.archiveUrl;
    }
  }
  if (isArchiveUrl(url)) {
    return url;
  }
  return undefined;
}

function resolveArchivedAt(
  source: Record<string, unknown>,
  lock: Record<string, LockEntry> | null,
): string | undefined {
  if (typeof source.archivedAt === "string" && source.archivedAt) {
    return source.archivedAt;
  }
  const url = typeof source.url === "string" ? source.url : "";
  if (lock) {
    const entry = lock[url] ?? lock[url.replace(/\/$/, "")] ?? lock[`${url}/`];
    if (typeof entry?.archivedAt === "string" && entry.archivedAt) {
      return entry.archivedAt;
    }
  }
  return undefined;
}

/**
 * Returns evidence sources, archive snapshot URLs, health status, and review provenance
 * for an individual lifecycle rule.
 */
export function sourcesOf(ruleId: string, options: SourcesOfOptions = {}): SourcesOfResult {
  if (typeof ruleId !== "string" || !ruleId.trim()) {
    throw new EbbError("rule-not-found", `Invalid rule id "${ruleId}".`);
  }
  const trimmedId = ruleId.trim();

  if (options.asOf !== undefined && !isIsoDate(options.asOf)) {
    throw new EbbError("invalid-date", `"${options.asOf}" is not a date (YYYY-MM-DD).`);
  }

  let foundRule: RegistryV2Rule | undefined;

  if (options.rules) {
    foundRule = options.rules.find((r) => r.id === trimmedId);
  } else if (options.registries) {
    for (const reg of options.registries) {
      const match = reg.rules.find((r) => r.id === trimmedId);
      if (match) {
        foundRule = match;
        break;
      }
    }
  } else {
    // Fast path: if the ID begins with an ecosystem name, check that ecosystem first
    const dotIdx = trimmedId.indexOf(".");
    const ecoPrefix = dotIdx !== -1 ? trimmedId.slice(0, dotIdx) : "";
    if (ecoPrefix && (BUNDLED_ECOSYSTEMS as readonly string[]).includes(ecoPrefix)) {
      const reg = bundledRegistry(ecoPrefix);
      foundRule = reg?.rules.find((r) => r.id === trimmedId);
    }

    if (!foundRule) {
      for (const eco of BUNDLED_ECOSYSTEMS) {
        if (eco === ecoPrefix) continue;
        const reg = bundledRegistry(eco);
        const match = reg?.rules.find((r) => r.id === trimmedId);
        if (match) {
          foundRule = match;
          break;
        }
      }
    }
  }

  if (!foundRule) {
    throw new EbbError("rule-not-found", `Rule "${trimmedId}" not found in registered lifecycle rules.`);
  }

  if (options.asOf !== undefined) {
    const observedAt = foundRule.provenance?.observedAt;
    if (observedAt && observedAt > options.asOf) {
      throw new EbbError("rule-not-found", `Rule "${trimmedId}" not found as of ${options.asOf}.`);
    }
  }

  const lock = getSourcesLock();
  const sourceEntries: SourceEntry[] = (foundRule.sources ?? []).map((s) => {
    const sRec = s as unknown as Record<string, unknown>;
    const health = resolveSourceHealth(sRec, lock);
    const archiveUrl = resolveArchiveUrl(sRec, lock);
    const archivedAt = resolveArchivedAt(sRec, lock);
    return {
      title: s.title,
      url: s.url,
      ...(s.accessedAt ? { accessedAt: s.accessedAt } : {}),
      ...(archiveUrl ? { archiveUrl } : {}),
      ...(archivedAt ? { archivedAt } : {}),
      health,
      status: health,
    };
  });

  const prov = foundRule.provenance;
  return {
    ruleId: foundRule.id,
    ecosystem: foundRule.ecosystem,
    purl: foundRule.purl,
    event: foundRule.event,
    title: foundRule.title,
    summary: foundRule.summary,
    severity: foundRule.severity,
    reviewer: prov?.reviewer ?? "unknown",
    reviewedAt: prov?.reviewedAt ?? "",
    observedAt: prov?.observedAt ?? "",
    sources: sourceEntries,
    ...(foundRule.deadline ? { deadline: foundRule.deadline } : {}),
    ...(foundRule.replacement ? { replacement: foundRule.replacement } : {}),
    ...(prov ? { provenance: prov } : {}),
    ...(prov?.method ? { method: prov.method } : {}),
    ...(prov?.reviewers ? { reviewers: prov.reviewers } : prov?.reviewer ? { reviewers: [prov.reviewer] } : {}),
    ...(prov?.importer ? { importer: prov.importer } : {}),
    ...(prov?.importerVersion ? { importerVersion: prov.importerVersion } : {}),
  };
}
