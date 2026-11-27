/**
 * xeol-compatible JSON output formatter.
 */

import type { CheckAllResult } from "../check-all-core.js";
import { isCheckAllError } from "../check-all-core.js";
import { VERSION } from "../version.js";
import type { SyftCheckItem, SyftDocument } from "./syft.js";

export interface XeolCycle {
  ProductName: string;
  ProductPermalink: string;
  ReleaseCycle: string;
  Eol: string;
  LatestRelease: string;
  LatestReleaseDate: string;
  ReleaseDate: string;
}

export interface XeolPackage {
  ID: string;
  Name: string;
  Version: string;
  Locations: Record<string, unknown>;
  Language: string;
  Licenses: string[] | null;
  Type: string;
  CPEs: string[] | null;
  PURL: string;
  Upstreams: unknown[] | null;
  MetadataType: string;
  Metadata: unknown;
}

export interface XeolArtifact {
  name: string;
  version: string;
  type: string;
  locations: unknown[];
  language: string;
  licenses: unknown[];
  cpes: string[];
  purl: string;
  upstreams: unknown[];
  metadataType?: string | undefined;
  metadata?: unknown;
}

export interface XeolEbbMeta {
  ruleId?: string | undefined;
  evidence?: string | null | undefined;
  dataVersion?: string | undefined;
}

export interface XeolMatch {
  Cycle: XeolCycle;
  Package: XeolPackage;
  artifact: XeolArtifact;
  ebb: XeolEbbMeta;
}

export interface XeolDocument {
  matches: XeolMatch[];
  source: Record<string, unknown>;
  distro: {
    name: string;
    version: string;
    idLike: string[];
  };
  descriptor: {
    name: string;
    version: string;
    configuration?: unknown;
    db?: unknown;
  };
}

/**
 * Builds a xeol-compatible JSON document object from evaluated check items.
 */
export function buildXeolDocument(
  items: SyftCheckItem[],
  outcome: CheckAllResult,
  syftDoc?: SyftDocument,
): XeolDocument {
  const matches: XeolMatch[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = outcome.results[i];
    if (!item || !entry || isCheckAllError(entry)) {
      continue;
    }

    // Include matches for components with non-ok status or matched rules
    if (entry.status !== "ok" || (entry.matches && entry.matches.length > 0)) {
      const matchEntries = entry.matches && entry.matches.length > 0 ? entry.matches : [undefined];

      for (const m of matchEntries) {
        const productName = item.artifact.name || item.purl;
        const releaseCycle = entry.version || item.version || "";
        const eol = m?.date || "true";
        const permalink = m?.ruleId ? `https://velella.sh/ebb/rules/${m.ruleId}` : "";

        const cycle: XeolCycle = {
          ProductName: productName,
          ProductPermalink: permalink,
          ReleaseCycle: releaseCycle,
          Eol: eol,
          LatestRelease: "",
          LatestReleaseDate: "",
          ReleaseDate: "",
        };

        const pkg: XeolPackage = {
          ID: item.id,
          Name: item.artifact.name || "",
          Version: item.artifact.version || item.version,
          Locations: {},
          Language: item.artifact.language || "",
          Licenses: null,
          Type: item.artifact.type || "",
          CPEs: null,
          PURL: item.artifact.purl || item.purl,
          Upstreams: null,
          MetadataType: item.artifact.metadataType || "",
          Metadata: null,
        };

        const artifact: XeolArtifact = {
          name: item.artifact.name || "",
          version: item.artifact.version || item.version,
          type: item.artifact.type || "",
          locations: Array.isArray(item.artifact.locations) ? item.artifact.locations : [],
          language: item.artifact.language || "",
          licenses: Array.isArray(item.artifact.licenses) ? item.artifact.licenses : [],
          cpes: Array.isArray(item.artifact.cpes) ? item.artifact.cpes : [],
          purl: item.artifact.purl || item.purl,
          upstreams: Array.isArray(item.artifact.upstreams) ? item.artifact.upstreams : [],
          metadataType: item.artifact.metadataType,
          metadata: item.artifact.metadata,
        };

        const ebbMeta: XeolEbbMeta = {
          ruleId: m?.ruleId,
          evidence: m?.sources?.[0]?.url ?? null,
          dataVersion: "2",
        };

        matches.push({
          Cycle: cycle,
          Package: pkg,
          artifact,
          ebb: ebbMeta,
        });
      }
    }
  }

  // Stable sort matching xeol's MatchSort:
  // 1. artifact.name
  // 2. Cycle.ReleaseCycle
  // 3. Cycle.ProductName
  // 4. artifact.version
  // 5. artifact.type
  matches.sort((a, b) => {
    if (a.artifact.name !== b.artifact.name) {
      return a.artifact.name.localeCompare(b.artifact.name);
    }
    if (a.Cycle.ReleaseCycle !== b.Cycle.ReleaseCycle) {
      return a.Cycle.ReleaseCycle.localeCompare(b.Cycle.ReleaseCycle);
    }
    if (a.Cycle.ProductName !== b.Cycle.ProductName) {
      return a.Cycle.ProductName.localeCompare(b.Cycle.ProductName);
    }
    if (a.artifact.version !== b.artifact.version) {
      return a.artifact.version.localeCompare(b.artifact.version);
    }
    return a.artifact.type.localeCompare(b.artifact.type);
  });

  const source =
    syftDoc?.source && typeof syftDoc.source === "object"
      ? (syftDoc.source as Record<string, unknown>)
      : { type: "unknown", target: "unknown" };

  const distroRaw = syftDoc?.distro && typeof syftDoc.distro === "object" ? syftDoc.distro : undefined;

  const distro = {
    name: typeof distroRaw?.name === "string" ? distroRaw.name : "",
    version: typeof distroRaw?.version === "string" ? distroRaw.version : "",
    idLike: Array.isArray(distroRaw?.idLike) ? distroRaw.idLike : [],
  };

  return {
    matches,
    source,
    distro,
    descriptor: {
      name: "ebb",
      version: VERSION,
    },
  };
}

/**
 * Formats evaluated check items into xeol-compatible JSON text.
 */
export function formatXeolJson(items: SyftCheckItem[], outcome: CheckAllResult, syftDoc?: SyftDocument): string {
  const doc = buildXeolDocument(items, outcome, syftDoc);
  return `${JSON.stringify(doc, null, 2)}\n`;
}
