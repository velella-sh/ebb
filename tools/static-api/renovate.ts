/**
 * Static Renovate custom datasource feeds.
 * Generates one feed file per component with release lines: /renovate/<type>/<name>.json
 * Each feed contains `releases` ([{ version, isDeprecated }]) plus `homepage` and `sourceUrl`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { purlToApiPath } from "../../src/api.js";
import { supportedVersions } from "../../src/pick-version.js";
import { parsePurl, purlIdentity } from "../../src/purl.js";
import type { RegistryV2Rule } from "../../src/registry.js";
import { sortKeys } from "./generate.js";

export interface WriteRenovateFeedsOptions {
  outDir: string;
  rules: readonly RegistryV2Rule[];
  baseUrl: string;
  /** Build timestamp. Its calendar day is the reference for deprecation determination. */
  createdAt: string;
}

export interface RenovateFeedInfo {
  purl: string;
  path: string;
  url: string;
  releasesCount: number;
  deprecatedCount: number;
  bytes: number;
}

export interface OmittedComponentInfo {
  purl: string;
  reason: string;
}

export interface WriteRenovateFeedsResult {
  feeds: Map<string, RenovateFeedInfo>;
  omitted: OmittedComponentInfo[];
  totalRawBytes: number;
}

export function renovateFeedPath(purl: string): string {
  return `renovate/${purlToApiPath(purl)}`;
}

function referenceDay(stamp: string): string {
  return stamp.slice(0, 10);
}

export function deriveUrls(
  purl: string,
  rules: readonly RegistryV2Rule[],
): { homepage?: string | undefined; sourceUrl?: string | undefined } {
  let homepage: string | undefined;
  let sourceUrl: string | undefined;

  for (const rule of rules) {
    for (const src of rule.sources ?? []) {
      if (!src.url) continue;
      const url = src.url;
      const lowerUrl = url.toLowerCase();
      const lowerTitle = (src.title ?? "").toLowerCase();
      if (
        !sourceUrl &&
        (lowerUrl.includes("github.com") ||
          lowerUrl.includes("gitlab.com") ||
          lowerTitle.includes("source") ||
          lowerTitle.includes("repo") ||
          lowerTitle.includes("repository"))
      ) {
        sourceUrl = url;
      }
      if (
        !homepage &&
        (lowerTitle.includes("homepage") ||
          lowerTitle.includes("home") ||
          lowerTitle.includes("official") ||
          lowerTitle.includes("documentation") ||
          lowerTitle.includes("website"))
      ) {
        homepage = url;
      }
    }
  }

  // Fallbacks based on package url type
  const parsed = parsePurl(purl);
  if (parsed) {
    if (!sourceUrl && parsed.type === "github") {
      sourceUrl = `https://github.com/${parsed.namespace ? `${parsed.namespace}/` : ""}${parsed.name}`;
    }
    if (!homepage) {
      if (parsed.type === "npm") {
        homepage = `https://www.npmjs.com/package/${parsed.name}`;
      } else if (parsed.type === "pypi") {
        homepage = `https://pypi.org/project/${parsed.name}`;
      } else if (parsed.type === "golang") {
        homepage = `https://pkg.go.dev/${parsed.name}`;
      } else if (parsed.type === "cargo") {
        homepage = `https://crates.io/crates/${parsed.name}`;
      } else if (parsed.type === "nuget") {
        homepage = `https://www.nuget.org/packages/${parsed.name}`;
      } else if (parsed.type === "generic" && parsed.name === "nodejs") {
        homepage = "https://nodejs.org";
        sourceUrl = sourceUrl ?? "https://github.com/nodejs/node";
      } else if (parsed.type === "generic" && parsed.name === "python") {
        homepage = "https://www.python.org";
        sourceUrl = sourceUrl ?? "https://github.com/python/cpython";
      } else if (parsed.type === "generic" && parsed.name === "golang") {
        homepage = "https://go.dev";
        sourceUrl = sourceUrl ?? "https://github.com/golang/go";
      }
    }
  }

  // Fallback to first rule source if still not determined
  if (!homepage && rules[0]?.sources[0]?.url) {
    homepage = rules[0].sources[0].url;
  }
  if (!sourceUrl && rules[0]?.sources[0]?.url) {
    sourceUrl = rules[0].sources[0].url;
  }

  return { homepage, sourceUrl };
}

/**
 * Writes the Renovate feed JSON files under `outDir/renovate/` and returns
 * the feed info for each component that has release lines.
 */
export async function writeRenovateFeeds(options: WriteRenovateFeedsOptions): Promise<WriteRenovateFeedsResult> {
  const reference = referenceDay(options.createdAt);

  const byComponent = new Map<string, RegistryV2Rule[]>();
  for (const rule of options.rules) {
    const identity = purlIdentity(rule.purl);
    const group = byComponent.get(identity) ?? [];
    group.push(rule);
    byComponent.set(identity, group);
  }

  const feeds = new Map<string, RenovateFeedInfo>();
  const omitted: OmittedComponentInfo[] = [];
  let totalRawBytes = 0;

  // Process components in deterministic sorted order
  const sortedIdentities = [...byComponent.keys()].sort();

  for (const identity of sortedIdentities) {
    const rules = byComponent.get(identity)!;
    const versionReport = supportedVersions(identity, {
      asOf: reference,
      rules,
    });

    if (versionReport.lines.length === 0) {
      omitted.push({
        purl: identity,
        reason: versionReport.notes[0] ?? "Component has rules, but none name a single release line.",
      });
      continue;
    }

    const { homepage, sourceUrl } = deriveUrls(identity, rules);

    const releases = versionReport.lines.map((line) => {
      const isDeprecated = line.status === "ended" || Boolean(line.endDate && line.endDate <= reference);
      return {
        version: line.id,
        isDeprecated,
      };
    });

    const feedDoc = sortKeys({
      releases,
      ...(homepage ? { homepage } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
    });

    const feedJson = JSON.stringify(feedDoc, null, 2);
    const feedBytes = Buffer.byteLength(feedJson, "utf8");
    totalRawBytes += feedBytes;

    const relativePath = renovateFeedPath(identity);
    const fullPath = join(options.outDir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, feedJson, "utf8");

    // Also support percent-encoded alias if namespace contains @ (e.g. %40angular)
    if (relativePath.includes("/@")) {
      const encodedRelPath = relativePath.replace("/@", "/%40");
      const encodedFilePath = join(options.outDir, encodedRelPath);
      await mkdir(dirname(encodedFilePath), { recursive: true });
      await writeFile(encodedFilePath, feedJson, "utf8");
    }

    // Also support unnamespaced alias for library images like docker/library/node.json -> docker/node.json
    if (relativePath.includes("/library/")) {
      const shortRelPath = relativePath.replace("/library/", "/");
      const shortFilePath = join(options.outDir, shortRelPath);
      await mkdir(dirname(shortFilePath), { recursive: true });
      await writeFile(shortFilePath, feedJson, "utf8");
    }

    const deprecatedCount = releases.filter((r) => r.isDeprecated).length;
    feeds.set(identity, {
      purl: identity,
      path: relativePath,
      url: `${options.baseUrl}/${relativePath}`,
      releasesCount: releases.length,
      deprecatedCount,
      bytes: feedBytes,
    });
  }

  return { feeds, omitted, totalRawBytes };
}
