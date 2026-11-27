/**
 * Client helpers for querying the Ebb static JSON API.
 * https://velella.sh/ebb/api/v1/
 */

import { type PackageUrl, parsePurl } from "./purl.js";
import type { Rule } from "./rules-for.js";
import { versContains } from "./vers.js";
import { EbbError } from "./errors.js";

export const DEFAULT_STATIC_API_BASE_URL = "https://velella.sh/ebb/api/v1";

/** Options for static API fetching. */
export interface FetchRuleOptions {
  /** Base URL for the static API. Defaults to "https://velella.sh/ebb/api/v1". */
  baseUrl?: string | undefined;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch | undefined;
  /** Filter rules as-of a specific date (ISO 8601 string or Date). */
  asOf?: string | Date | undefined;
  /** Request timeout in milliseconds. Defaults to 5000ms. */
  timeout?: number | undefined;
}

/** API metadata document served at `/api/v1/meta.json`. */
export interface ApiMetaDocument {
  $schema?: string | undefined;
  schemaVersion: string;
  version: string;
  dataVersion: string;
  rulesCount: number;
  componentsCount: number;
  ecosystemsCount: number;
  schemaVersions: Record<string, string | number>;
}

/** An upcoming event entry in `/api/v1/upcoming.json`. */
export interface ApiUpcomingItem {
  ruleId: string;
  purl: string;
  ecosystem: string;
  event: string;
  title: string;
  deadline?: string | undefined;
  severity?: string | undefined;
  replacement?: string | undefined;
  path: string;
}

/** Upcoming deadlines document served at `/api/v1/upcoming.json`. */
export interface ApiUpcomingDocument {
  $schema?: string | undefined;
  schemaVersion: string;
  version: string;
  generatedAt: string;
  count: number;
  upcoming: ApiUpcomingItem[];
}

/** A single rule document served at `/api/v1/rules/<rule-id>.json`. */
export interface ApiRuleDocument {
  $schema?: string | undefined;
  schemaVersion: string;
  version: string;
  generatedAt: string;
  rule: Rule;
}

/** A component document served at `/api/v1/<type>/<name>.json`. */
export interface ApiComponentDocument {
  $schema?: string | undefined;
  schemaVersion: string;
  version: string;
  generatedAt: string;
  purl: string;
  type: string;
  name: string;
  namespace?: string | undefined;
  ecosystems: string[];
  rules: Rule[];
  /** @deprecated No longer set. */
  hint?: string | undefined;
  /** Feed URL for this component, present when it has a deadline that has not passed. */
  calendar?: string | undefined;
  /** Release lines derived from this component's rules. Omitted on older documents. */
  versions?: {
    asOf: string;
    complete: boolean;
    reason: string;
    recommendation: { lineId: string; reason: string } | null;
    notes: string[];
    lines: Array<{
      id: string;
      vers: string;
      status: "ended" | "ending" | "no-known-end";
      endDate: string | null;
      ruleId: string;
      event: string;
    }>;
  };
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
 * Performs a fetch request with timeout and one automatic retry on network failure.
 * Returns null if the resource returns HTTP 404 (typed "not found" result).
 */
async function fetchWithRetry(url: string, options?: FetchRuleOptions): Promise<Response | null> {
  if (process.env.EBB_OFFLINE === "1") {
    throw new EbbError("offline", "Static API client cannot make network requests when EBB_OFFLINE=1 is set.");
  }

  const fetchFn = options?.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("No global fetch available. Pass a custom fetch implementation in options.fetch.");
  }

  const timeoutMs = options?.timeout ?? 5000;

  async function executeFetch(): Promise<Response> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let signal: AbortSignal | undefined;
    if (typeof AbortController !== "undefined" && timeoutMs > 0) {
      const controller = new AbortController();
      signal = controller.signal;
      timer = setTimeout(() => {
        controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    try {
      return await fetchFn(url, signal ? { signal } : undefined);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  let response: Response;
  try {
    response = await executeFetch();
  } catch (err) {
    // Retry once on network failure or timeout
    try {
      response = await executeFetch();
    } catch {
      throw err;
    }
  }

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch static API component at ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return response;
}

function cleanBaseUrl(url?: string): string {
  let u = url ?? DEFAULT_STATIC_API_BASE_URL;
  while (u.endsWith("/")) {
    u = u.slice(0, -1);
  }
  return u;
}

/**
 * Fetches the metadata document from `/api/v1/meta.json`.
 * Clients should call this first to check data version and component/rule counts.
 * Returns null if not found (404).
 */
export async function fetchMeta(options?: FetchRuleOptions): Promise<ApiMetaDocument | null> {
  const baseUrl = cleanBaseUrl(options?.baseUrl);
  const url = `${baseUrl}/meta.json`;
  const response = await fetchWithRetry(url, options);
  if (!response) {
    return null;
  }
  return (await response.json()) as ApiMetaDocument;
}

/**
 * Fetches scheduled upcoming deprecations and EOL deadlines from `/api/v1/upcoming.json`.
 * Returns null if not found (404).
 */
export async function fetchUpcoming(options?: FetchRuleOptions): Promise<ApiUpcomingDocument | null> {
  const baseUrl = cleanBaseUrl(options?.baseUrl);
  const url = `${baseUrl}/upcoming.json`;
  const response = await fetchWithRetry(url, options);
  if (!response) {
    return null;
  }
  return (await response.json()) as ApiUpcomingDocument;
}

/**
 * Fetches a single rule document by rule id from `/api/v1/rules/<rule-id>.json`.
 * Returns null if not found (404).
 */
export async function fetchSingleRule(ruleId: string, options?: FetchRuleOptions): Promise<ApiRuleDocument | null> {
  const baseUrl = cleanBaseUrl(options?.baseUrl);
  const url = `${baseUrl}/rules/${encodeURIComponent(ruleId)}.json`;
  const response = await fetchWithRetry(url, options);
  if (!response) {
    return null;
  }
  return (await response.json()) as ApiRuleDocument;
}

/**
 * Fetches the full component document for a component from the static API.
 * Returns null if the component is not found (404).
 */
export async function fetchComponent(purl: string, options?: FetchRuleOptions): Promise<ApiComponentDocument | null> {
  const baseUrl = cleanBaseUrl(options?.baseUrl);
  const relPath = purlToApiPath(purl);
  const url = `${baseUrl}/${relPath}`;

  const response = await fetchWithRetry(url, options);
  if (!response) {
    return null;
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
