/**
 * Client helpers for querying the Ebb static JSON API.
 * https://velella.sh/ebb/api/v1/
 */

import { type PackageUrl, parsePurl } from "./purl.js";
import type { Rule } from "./rules-for.js";
import { versContains } from "./vers.js";

export const DEFAULT_STATIC_API_BASE_URL = "https://velella.sh/ebb/api/v1";

/** Options for static API fetching. */
export interface FetchRuleOptions {
  /** Base URL for the static API. Defaults to "https://velella.sh/ebb/api/v1". */
  baseUrl?: string | undefined;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch | undefined;
  /** Filter rules as-of a specific date (ISO 8601 string or Date). */
  asOf?: string | Date | undefined;
}

/** A component document served at `/api/v1/<type>/<name>.json`. */
export interface ApiComponentDocument {
  schemaVersion: string;
  version: string;
  generatedAt: string;
  purl: string;
  type: string;
  name: string;
  namespace?: string | undefined;
  ecosystems: string[];
  rules: Rule[];
  hint?: string | undefined;
}

/**
 * Maps a Package URL (or parsed PURL) to its relative static API file path.
 *
 * For example:
 * - `pkg:npm/request` to `npm/request.json`
 * - `pkg:npm/@angular/core@12.0.0` to `npm/@angular/core.json`
 * - `pkg:github-actions/actions/checkout` to `github-actions/actions/checkout.json`
 */
export function purlToApiPath(purl: string | PackageUrl): string {
  const parsed = typeof purl === "string" ? (purl.startsWith("pkg:") ? parsePurl(purl) : null) : purl;

  if (parsed) {
    const segments = [parsed.type];
    if (parsed.namespace) {
      for (const seg of parsed.namespace.split("/").filter(Boolean)) {
        try {
          segments.push(decodeURIComponent(seg));
        } catch {
          segments.push(seg);
        }
      }
    }
    try {
      segments.push(decodeURIComponent(parsed.name));
    } catch {
      segments.push(parsed.name);
    }
    return `${segments.join("/")}.json`;
  }

  // Fallback for plain string path
  const str = String(purl).trim();
  if (str.startsWith("pkg:")) {
    const withoutPkg = str.slice(4);
    const slashIdx = withoutPkg.indexOf("/");
    if (slashIdx !== -1) {
      const type = withoutPkg.slice(0, slashIdx);
      const queryPart = withoutPkg.slice(slashIdx + 1).split("?")[0] ?? "";
      const hashPart = queryPart.split("#")[0] ?? "";
      const atPart = hashPart.split("@")[0] ?? "";
      const decodedSegments = atPart.split("/").map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      });
      return `${type}/${decodedSegments.join("/")}.json`;
    }
  }

  if (str.includes("/")) {
    return `${str.endsWith(".json") ? str : `${str}.json`}`;
  }

  return `npm/${str}.json`;
}

/**
 * Fetches the full component document for a component from the static API.
 * Returns null if the component is not found (404).
 */
export async function fetchComponent(purl: string, options?: FetchRuleOptions): Promise<ApiComponentDocument | null> {
  const fetchFn = options?.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("No global fetch available. Pass a custom fetch implementation in options.fetch.");
  }

  const baseUrl = (options?.baseUrl ?? DEFAULT_STATIC_API_BASE_URL).replace(/\/+$/, "");
  const relPath = purlToApiPath(purl);
  const url = `${baseUrl}/${relPath}`;

  const response = await fetchFn(url);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch static API component at ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ApiComponentDocument;
}

/**
 * Fetches the active lifecycle rules for a PURL from the static API.
 *
 * If the PURL contains a version (e.g. `pkg:npm/request@2.88.2`), only rules that
 * match the given version are returned.
 * If no version is specified, all registered rules for the component are returned.
 * Returns null if the component is not registered.
 */
export async function fetchRule(purl: string, options?: FetchRuleOptions): Promise<Rule[] | null> {
  const comp = await fetchComponent(purl, options);
  if (!comp) {
    return null;
  }

  const parsed = purl.startsWith("pkg:") ? parsePurl(purl) : null;
  const version = parsed?.version;

  let rules = comp.rules;

  if (version) {
    rules = rules.filter((rule) => {
      try {
        return versContains(rule.vers, version);
      } catch {
        return false;
      }
    });
  }

  if (options?.asOf) {
    const asOfDate = typeof options.asOf === "string" ? options.asOf : options.asOf.toISOString().slice(0, 10);
    rules = rules.filter((rule) => {
      if (!rule.deadline) return true;
      return rule.deadline <= asOfDate;
    });
  }

  return rules;
}
