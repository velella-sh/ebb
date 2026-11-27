// Checks that the evidence behind every lifecycle rule is still reachable and has not moved.
//
//   node dist/tools/check-sources.js [--out report.json] [--summary summary.md] [--update-lock]
//                                    [--fail-on stale,changed,unreachable,date-missing,date-changed]
//                                    [--open-issues] [--propose-pr]
//
// Reports, separately: rules not reviewed within their freshness window (stale), sources that cannot
// be fetched (unreachable), sources that moved or were retitled since they were recorded (changed),
// sources behind a bot challenge (blocked), sources not recorded yet (unrecorded), dates missing from
// source content (date-missing), and changed dates in structured sources (date-changed).
// It never edits rules. Only `--update-lock`, run by a maintainer, writes the lock file.
// Scans never use this tool or the network.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

import { REGISTRY_V2_SCHEMA_VERSION, staleRules, validateRegistryV2 } from "../src/registry.js";
import type { RegistryV2, RegistryV2Rule, StaleRule } from "../src/registry.js";
import { containsDate } from "./source-date.js";

export const SOURCE_CHECK_SCHEMA = "ebb.source-check.v1" as const;
export const SOURCE_LOCK_SCHEMA = "ebb.source-lock.v1" as const;

export interface SourceObservation {
  /** HTTP status of the final response, or null when the request failed. */
  status: number | null;
  finalUrl: string | null;
  title: string | null;
  error?: string;
  redirected?: boolean;
  contentSnippet?: string;
}

export interface LockEntry {
  finalUrl: string;
  title: string | null;
  checkedAt: string;
  status?:
    | "ok"
    | "unreachable"
    | "changed"
    | "blocked"
    | "unrecorded"
    | "date-missing"
    | "date-changed"
    | "archived-only";
  archiveUrl?: string;
  firstFailedAt?: string | undefined;
}

export interface SourceLock {
  schemaVersion: typeof SOURCE_LOCK_SCHEMA;
  sources: Record<string, LockEntry>;
}

export type ChangeReason = "final-url" | "title" | "redirect" | "version-missing";

export interface SourceReport {
  schemaVersion: typeof SOURCE_CHECK_SCHEMA;
  checkedAt: string;
  registries: number;
  rules: number;
  sources: number;
  ok: number;
  stale: (StaleRule & { registry: string })[];
  /** Scheduled end-of-life rules whose announced date has passed: a reviewer turns each into its end-of-support or end-of-life rule (decision 0010). */
  duePromotion: { registry: string; ruleId: string; deadline: string }[];
  unreachable: { url: string; reason: string; ruleIds: string[] }[];
  changed: {
    url: string;
    reasons: ChangeReason[];
    recorded: LockEntry;
    current: { finalUrl: string; title: string | null };
    ruleIds: string[];
  }[];
  blocked: { url: string; status: number; ruleIds: string[] }[];
  unrecorded: { url: string; ruleIds: string[] }[];
  "date-missing"?: { url: string; ruleIds: string[]; deadline: string }[];
  "date-changed"?: { url: string; ruleIds: string[]; expected: string; actual: string | null; pointer?: string }[];
  "archived-only"?: { url: string; archiveUrl: string; reason: string; ruleIds: string[] }[];
}

export type FailCategory = "stale" | "changed" | "unreachable" | "date-missing" | "date-changed" | "archived-only";

export interface CheckInput {
  registries: { name: string; registry: RegistryV2 }[];
  lock: SourceLock;
  now: Date;
  observe: (url: string) => Promise<SourceObservation>;
  concurrency?: number;
}

/** Titles that a site uses on its bot-block page. Oracle answers automated requests with "403 Oracle Export Error" or "Technical Difficulties". */
const BOT_CHALLENGE =
  /just a moment|attention required|access denied|verify you are human|are you a robot|security check|oracle export error|technical difficulties/i;

/** Fastly serves this challenge page with a 200 status, so status alone does not identify it. */
const CHALLENGE_PAGE = /^client challenge$/i;

const normalizeText = (value: string | null) => (value ?? "").replace(/\s+/g, " ").trim();

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  return url.href.replace(/\/$/, "");
}

export function isBotChallenge(observation: SourceObservation): boolean {
  if (observation.status === null) return false;
  if (CHALLENGE_PAGE.test(observation.title ?? "")) return true;
  return [403, 429, 503].includes(observation.status) && BOT_CHALLENGE.test(observation.title ?? "");
}

/** Limits concurrent outgoing requests to at most 2 per host. */
export class HostRateLimiter {
  private active = new Map<string, number>();
  private queue = new Map<string, Array<() => void>>();
  readonly maxPerHost: number;

  constructor(maxPerHost = 2) {
    this.maxPerHost = maxPerHost;
  }

  async acquire(url: string): Promise<() => void> {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = "unknown";
    }

    const current = this.active.get(host) ?? 0;
    if (current < this.maxPerHost) {
      this.active.set(host, current + 1);
      return () => this.release(host);
    }

    return new Promise<() => void>((resolve) => {
      let q = this.queue.get(host);
      if (!q) {
        q = [];
        this.queue.set(host, q);
      }
      q.push(() => {
        this.active.set(host, (this.active.get(host) ?? 0) + 1);
        resolve(() => this.release(host));
      });
    });
  }

  private release(host: string): void {
    const q = this.queue.get(host);
    if (q && q.length > 0) {
      const next = q.shift()!;
      next();
    } else {
      const current = (this.active.get(host) ?? 1) - 1;
      if (current <= 0) {
        this.active.delete(host);
      } else {
        this.active.set(host, current);
      }
    }
  }
}

/** Evaluates an RFC 6901 JSON pointer against an object. */
export function evaluateJsonPointer(doc: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) {
    throw new Error(`Invalid JSON pointer "${pointer}": must start with "/"`);
  }
  const parts = pointer
    .slice(1)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current: unknown = doc;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) return undefined;
      current = current[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

function dateMatches(expectedDeadline: string, actualValue: string): boolean {
  if (expectedDeadline === actualValue) return true;
  // Year-month precision from source (e.g. "2027-10" matches "2027-10-31")
  if (/^\d{4}-\d{2}$/.test(actualValue) && expectedDeadline.startsWith(`${actualValue}-`)) return true;
  return false;
}

async function inBatches<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]!);
      }
    }),
  );
  return results;
}

export function extractRuleVersionTokens(rule: RegistryV2Rule): string[] {
  const tokens = new Set<string>();
  const matches = rule.vers.match(/\b\d+(?:\.\d+)+\b/g);
  if (matches) {
    for (const m of matches) {
      tokens.add(m);
      const major = m.split(".")[0];
      if (major && Number(major) >= 10) tokens.add(major);
    }
  }
  return [...tokens];
}

/** Runs every check. `observe` is injected so tests never touch the network. */
export async function checkSources(
  input: CheckInput,
): Promise<{ report: SourceReport; observations: Map<string, SourceObservation> }> {
  const rulesByUrl = new Map<string, Set<string>>();
  const rulesListByUrl = new Map<string, RegistryV2Rule[]>();
  let ruleCount = 0;
  const stale: SourceReport["stale"] = [];
  const duePromotion: SourceReport["duePromotion"] = [];
  const today = input.now.toISOString().slice(0, 10);
  for (const { name, registry } of input.registries) {
    stale.push(...staleRules(registry, input.now).map((entry) => ({ registry: name, ...entry })));
    for (const rule of registry.rules) {
      ruleCount++;
      if (rule.event === "scheduled-end-of-life" && rule.deadline !== undefined && rule.deadline < today)
        duePromotion.push({ registry: name, ruleId: rule.id, deadline: rule.deadline });
      for (const source of rule.sources) {
        if (!rulesByUrl.has(source.url)) rulesByUrl.set(source.url, new Set());
        rulesByUrl.get(source.url)!.add(rule.id);
        if (!rulesListByUrl.has(source.url)) rulesListByUrl.set(source.url, []);
        rulesListByUrl.get(source.url)!.push(rule);
      }
    }
  }

  const urls = [...rulesByUrl.keys()].sort();
  const limiter = new HostRateLimiter(2);
  const observed = await inBatches(urls, input.concurrency ?? 4, async (url) => {
    const release = await limiter.acquire(url);
    try {
      return await input.observe(url);
    } finally {
      release();
    }
  });
  const observations = new Map(urls.map((url, index) => [url, observed[index]!]));
  const ids = (url: string) => [...rulesByUrl.get(url)!].sort();

  const dateMissing: NonNullable<SourceReport["date-missing"]> = [];
  const dateChanged: NonNullable<SourceReport["date-changed"]> = [];
  const archivedOnly: NonNullable<SourceReport["archived-only"]> = [];

  const report: SourceReport = {
    schemaVersion: SOURCE_CHECK_SCHEMA,
    checkedAt: input.now.toISOString(),
    registries: input.registries.length,
    rules: ruleCount,
    sources: urls.length,
    ok: 0,
    stale: stale.sort((a, b) => a.registry.localeCompare(b.registry) || a.ruleId.localeCompare(b.ruleId)),
    duePromotion: duePromotion.sort((a, b) => a.deadline.localeCompare(b.deadline) || a.ruleId.localeCompare(b.ruleId)),
    unreachable: [],
    changed: [],
    blocked: [],
    unrecorded: [],
    "date-missing": dateMissing,
    "date-changed": dateChanged,
    "archived-only": archivedOnly,
  };

  for (const url of urls) {
    const observation = observations.get(url)!;
    const associatedRules = rulesListByUrl.get(url) ?? [];

    if (isBotChallenge(observation)) {
      report.blocked.push({ url, status: observation.status!, ruleIds: ids(url) });
      continue;
    }

    if (observation.status === null || observation.status < 200 || observation.status >= 300 || !observation.finalUrl) {
      // Check for an archived copy when the primary source is dead (Sub-issue 5)
      const archiveUrl =
        associatedRules
          .find((r) => r.sources.some((s) => s.url === url && s.archiveUrl))
          ?.sources.find((s) => s.url === url && s.archiveUrl)?.archiveUrl ?? input.lock.sources[url]?.archiveUrl;

      let archiveSuccess = false;
      if (archiveUrl) {
        const release = await limiter.acquire(archiveUrl);
        let archiveObs: SourceObservation | undefined;
        try {
          archiveObs = await input.observe(archiveUrl);
        } finally {
          release();
        }

        if (
          archiveObs &&
          archiveObs.status !== null &&
          archiveObs.status >= 200 &&
          archiveObs.status < 300 &&
          archiveObs.finalUrl
        ) {
          archiveSuccess = true;
          const reason = observation.error ?? `HTTP ${observation.status}`;
          archivedOnly.push({ url, archiveUrl, reason, ruleIds: ids(url) });

          // Run date checks on the archived copy
          const archiveText = archiveObs.contentSnippet ?? archiveObs.title ?? "";
          for (const rule of associatedRules) {
            const src = rule.sources.find((s) => s.url === url);
            if (src?.pointer) {
              let parsedJson: unknown = undefined;
              try {
                parsedJson = JSON.parse(archiveText);
              } catch {
                // not JSON
              }
              const val = parsedJson !== undefined ? evaluateJsonPointer(parsedJson, src.pointer) : undefined;
              if (val === undefined) {
                dateChanged.push({
                  url,
                  ruleIds: [rule.id],
                  expected: rule.deadline ?? "",
                  actual: null,
                  pointer: src.pointer,
                });
              } else if (rule.deadline !== undefined && !dateMatches(rule.deadline, String(val).trim())) {
                dateChanged.push({
                  url,
                  ruleIds: [rule.id],
                  expected: rule.deadline,
                  actual: String(val).trim(),
                  pointer: src.pointer,
                });
              }
            } else if (rule.deadline !== undefined && !containsDate(archiveText, rule.deadline)) {
              dateMissing.push({ url, ruleIds: [rule.id], deadline: rule.deadline });
            }
          }
        }
      }

      if (!archiveSuccess) {
        const reason = observation.error ?? `HTTP ${observation.status}`;
        report.unreachable.push({ url, reason, ruleIds: ids(url) });
      }
      continue;
    }

    const recorded = input.lock.sources[url];
    if (!recorded) {
      report.unrecorded.push({ url, ruleIds: ids(url) });
      continue;
    }

    const reasons: ChangeReason[] = [];
    if (normalizeUrl(recorded.finalUrl) !== normalizeUrl(observation.finalUrl)) reasons.push("final-url");
    if (normalizeText(recorded.title) !== normalizeText(observation.title)) reasons.push("title");
    if (
      observation.redirected &&
      (new URL(url).pathname !== new URL(observation.finalUrl).pathname ||
        new URL(url).hostname !== new URL(observation.finalUrl).hostname) &&
      !reasons.includes("final-url")
    ) {
      reasons.push("redirect");
    }
    if (observation.contentSnippet) {
      const versionTokens = associatedRules.flatMap(extractRuleVersionTokens);
      if (versionTokens.length > 0) {
        const fullText = `${observation.title ?? ""} ${observation.contentSnippet}`.toLowerCase();
        const hasMention = versionTokens.some((tok) => fullText.includes(tok.toLowerCase()));
        if (!hasMention) {
          reasons.push("version-missing");
        }
      }
    }

    if (reasons.length > 0) {
      report.changed.push({
        url,
        reasons,
        recorded,
        current: { finalUrl: observation.finalUrl, title: observation.title },
        ruleIds: ids(url),
      });
    }

    // Date check (Sub-issues 2 and 3)
    let dateFailed = false;
    const content = observation.contentSnippet ?? observation.title ?? "";
    for (const rule of associatedRules) {
      const src = rule.sources.find((s) => s.url === url);
      if (src?.pointer) {
        let parsedJson: unknown = undefined;
        try {
          parsedJson = JSON.parse(content);
        } catch {
          // not JSON
        }
        const val = parsedJson !== undefined ? evaluateJsonPointer(parsedJson, src.pointer) : undefined;
        if (val === undefined) {
          dateFailed = true;
          dateChanged.push({
            url,
            ruleIds: [rule.id],
            expected: rule.deadline ?? "",
            actual: null,
            pointer: src.pointer,
          });
        } else if (rule.deadline !== undefined && !dateMatches(rule.deadline, String(val).trim())) {
          dateFailed = true;
          dateChanged.push({
            url,
            ruleIds: [rule.id],
            expected: rule.deadline,
            actual: String(val).trim(),
            pointer: src.pointer,
          });
        }
      } else if (rule.deadline !== undefined && !containsDate(content, rule.deadline)) {
        dateFailed = true;
        dateMissing.push({
          url,
          ruleIds: [rule.id],
          deadline: rule.deadline,
        });
      }
    }

    if (reasons.length === 0 && !dateFailed) {
      report.ok++;
    }
  }
  return { report, observations };
}

/** The lock after a maintainer accepts what was observed: reachable pages are recorded, failures and challenge pages keep their old entry. */
export function updatedLock(
  lock: SourceLock,
  observations: Map<string, SourceObservation>,
  now: Date,
  report?: SourceReport,
): SourceLock {
  const sources: Record<string, LockEntry> = {};
  for (const [url, observation] of [...observations].sort(([a], [b]) => a.localeCompare(b))) {
    const existing = lock.sources[url];
    if (
      !isBotChallenge(observation) &&
      observation.status !== null &&
      observation.status >= 200 &&
      observation.status < 300 &&
      observation.finalUrl
    ) {
      const isChanged = report?.changed.some((c) => c.url === url);
      const isDateMissing = report?.["date-missing"]?.some((c) => c.url === url);
      const isDateChanged = report?.["date-changed"]?.some((c) => c.url === url);
      let status: LockEntry["status"] = existing?.status ?? "ok";
      if (report !== undefined) {
        if (isChanged) status = "changed";
        else if (isDateChanged) status = "date-changed";
        else if (isDateMissing) status = "date-missing";
        else status = "ok";
      }
      sources[url] = {
        finalUrl: observation.finalUrl,
        title: observation.title,
        checkedAt: now.toISOString().slice(0, 10),
        ...(existing?.status !== undefined || report !== undefined ? { status } : {}),
        ...(existing?.archiveUrl ? { archiveUrl: existing.archiveUrl } : {}),
      };
    } else if (existing) {
      sources[url] = existing;
    }
  }
  return { schemaVersion: SOURCE_LOCK_SCHEMA, sources };
}

export function failingCategories(report: SourceReport, failOn: readonly FailCategory[]): FailCategory[] {
  return failOn.filter((category) => {
    const list = report[category] as unknown[] | undefined;
    return Array.isArray(list) && list.length > 0;
  });
}

export function renderSummary(report: SourceReport): string {
  const lines = [
    "## Source freshness",
    "",
    `Checked ${report.sources} sources behind ${report.rules} rules on ${report.checkedAt.slice(0, 10)}.`,
    "",
    "| Result | Count |",
    "|---|---|",
    `| Unchanged | ${report.ok} |`,
    `| Stale rules (past their review window) | ${report.stale.length} |`,
    `| Scheduled rules whose date has passed (due for promotion) | ${report.duePromotion.length} |`,
    `| Changed sources (moved or retitled) | ${report.changed.length} |`,
    `| Unreachable sources | ${report.unreachable.length} |`,
    `| Archived only (dead source with verified archive) | ${report["archived-only"]?.length ?? 0} |`,
    `| Date missing from source | ${report["date-missing"]?.length ?? 0} |`,
    `| Date changed in structured source | ${report["date-changed"]?.length ?? 0} |`,
    `| Blocked by a bot challenge (not verifiable) | ${report.blocked.length} |`,
    `| Not recorded yet | ${report.unrecorded.length} |`,
    "",
  ];
  const section = (title: string, items: string[]) => {
    if (items.length > 0) lines.push(`### ${title}`, "", ...items, "");
  };
  section(
    "Stale rules",
    report.stale.map(
      (entry) =>
        `- \`${entry.ruleId}\` (${entry.registry}): reviewed ${entry.reviewedAt}, ${entry.ageDays} days ago; window is ${entry.maxReviewAgeDays}`,
    ),
  );
  section(
    "Due for promotion",
    report.duePromotion.map(
      (entry) =>
        `- \`${entry.ruleId}\` (${entry.registry}): announced for ${entry.deadline}; change it to the end-of-support or end-of-life rule, keeping its id`,
    ),
  );
  section(
    "Changed sources",
    report.changed.map(
      (entry) =>
        `- ${entry.url} (${entry.reasons.join(", ")}) → ${entry.current.finalUrl}; rules: ${entry.ruleIds.map((id) => `\`${id}\``).join(", ")}`,
    ),
  );
  section(
    "Unreachable sources",
    report.unreachable.map(
      (entry) => `- ${entry.url}: ${entry.reason}; rules: ${entry.ruleIds.map((id) => `\`${id}\``).join(", ")}`,
    ),
  );
  section(
    "Archived only",
    (report["archived-only"] ?? []).map(
      (entry) =>
        `- ${entry.url} (archive: ${entry.archiveUrl}); rules: ${entry.ruleIds.map((id) => `\`${id}\``).join(", ")}`,
    ),
  );
  section(
    "Date missing from source",
    (report["date-missing"] ?? []).map(
      (entry) =>
        `- ${entry.url} (deadline ${entry.deadline}); rules: ${entry.ruleIds.map((id) => `\`${id}\``).join(", ")}`,
    ),
  );
  section(
    "Date changed in structured source",
    (report["date-changed"] ?? []).map(
      (entry) =>
        `- ${entry.url} (expected ${entry.expected}, found ${entry.actual ?? "unresolved"}${entry.pointer ? ` at ${entry.pointer}` : ""}); rules: ${entry.ruleIds.map((id) => `\`${id}\``).join(", ")}`,
    ),
  );
  section(
    "Blocked by a bot challenge",
    report.blocked.map(
      (entry) => `- ${entry.url} (HTTP ${entry.status}); rules: ${entry.ruleIds.map((id) => `\`${id}\``).join(", ")}`,
    ),
  );
  section(
    "Not recorded yet",
    report.unrecorded.map((entry) => `- ${entry.url}`),
  );
  lines.push(
    "Rules are never edited by this check. A maintainer reviews each item, updates the rule and its provenance, and refreshes `registry/sources.lock.json` with `node dist/tools/check-sources.js --update-lock`.",
  );
  return `${lines.join("\n")}\n`;
}

const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;

export function normalizeGitHubBlobUrl(url: string): { owner: string; repo: string; ref: string; path: string } | null {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]!, ref: match[3]!, path: match[4]! };
}

export async function fetchGitHubFileViaApi(
  url: string,
  token?: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<SourceObservation | null> {
  const parsed = normalizeGitHubBlobUrl(url);
  if (!parsed) return null;
  const { owner, repo, ref, path } = parsed;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  const headers: Record<string, string> = {
    "user-agent": "ebb-source-check (+https://github.com/velella-sh/ebb)",
    accept: "application/vnd.github.v3+json",
  };
  const tok = token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (tok) headers.authorization = `Bearer ${tok}`;

  try {
    const res = await fetchFn(apiUrl, { headers });
    if (res.status === 404) {
      return { status: 404, finalUrl: url, title: null, error: "File not found via GitHub API" };
    }
    if (res.status === 403 || res.status === 429) {
      return { status: res.status, finalUrl: url, title: null, error: `GitHub API rate limited (${res.status})` };
    }
    if (!res.ok) {
      return { status: res.status, finalUrl: url, title: null, error: `GitHub API error ${res.status}` };
    }
    const data = (await res.json()) as { content?: string; encoding?: string; name?: string };
    let content = "";
    if (data.encoding === "base64" && data.content) {
      content = Buffer.from(data.content.replace(/\s+/g, ""), "base64").toString("utf8");
    }
    return {
      status: 200,
      finalUrl: url,
      title: `${owner}/${repo}: ${data.name ?? path}`,
      contentSnippet: content,
    };
  } catch (err) {
    return { status: null, finalUrl: url, title: null, error: (err as Error).message };
  }
}

/** Fetches one page, retrying on 429/5xx with backoff, and reads the start of the body. */
export async function fetchObservation(
  url: string,
  timeoutMs = 15_000,
  maxRetries = 2,
  sleepFn: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  includeSnippet = false,
  token?: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<SourceObservation> {
  if (normalizeGitHubBlobUrl(url)) {
    const ghObs = await fetchGitHubFileViaApi(url, token, fetchFn);
    if (ghObs) return ghObs;
  }
  let last: SourceObservation = { status: null, finalUrl: null, title: null, error: "not attempted" };
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "ebb-source-check (+https://github.com/velella-sh/ebb)",
          accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
          // Ask for English so a localized redirect or title does not look like a moved source.
          "accept-language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const finalUrl = response.url || url;
      const redirected = response.redirected || normalizeUrl(url) !== normalizeUrl(finalUrl);

      let head = "";
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (head.length < 262_144) {
          const { done, value } = await reader.read();
          if (done) break;
          head += decoder.decode(value, { stream: true });
          if (TITLE.test(head) && !includeSnippet) break;
        }
        await reader.cancel().catch(() => undefined);
      }
      const title = TITLE.exec(head)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
      last = {
        status: response.status,
        finalUrl,
        title,
        ...(includeSnippet && redirected ? { redirected: true } : {}),
        ...(includeSnippet && head ? { contentSnippet: head } : {}),
      };

      if (response.status === 429 || response.status === 503 || response.status >= 500) {
        if (attempt < maxRetries - 1) {
          let retryDelayMs = Math.min(500 * Math.pow(2, attempt), 4000);
          const retryAfter = response.headers.get("retry-after");
          if (retryAfter) {
            const parsedSeconds = Number(retryAfter);
            if (!Number.isNaN(parsedSeconds) && parsedSeconds > 0) {
              retryDelayMs = Math.min(parsedSeconds * 1000, 10_000);
            }
          }
          await sleepFn(retryDelayMs);
          continue;
        }
      }

      return last;
    } catch (error) {
      last = { status: null, finalUrl: null, title: null, error: (error as Error).message.slice(0, 120) };
      if (attempt < maxRetries - 1) {
        await sleepFn(Math.min(500 * Math.pow(2, attempt), 2000));
      }
    }
  }
  return last;
}

export const DEAD_SOURCE_MARKER_PREFIX = "<!-- ebb-dead-source:";
export const DEAD_SOURCE_LABELS = ["good first issue", "help wanted", "area: data", "type: task", "lane: free-agent"];

export interface DeadSourceIssue {
  url: string;
  ruleIds: string[];
  reason: string;
  title: string;
  body: string;
  labels: string[];
}

export function formatDeadSourceMarker(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  return `${DEAD_SOURCE_MARKER_PREFIX} ${hash} -->`;
}

export function extractDeadSourceHash(body: string): string | null {
  const match = body.match(/<!--\s*ebb-dead-source:\s*([a-f0-9]+)\s*-->/);
  return match ? match[1]! : null;
}

export function renderDeadSourceIssue(entry: { url: string; reason: string; ruleIds: string[] }): DeadSourceIssue {
  const marker = formatDeadSourceMarker(entry.url);
  const primaryRule = entry.ruleIds[0] ?? "rule";
  const title = `data: broken source URL for ${primaryRule}`;
  const body = `${marker}
### Evidence source unreachable

The authoritative evidence source behind lifecycle rules is no longer reachable:

- **Source URL**: \`${entry.url}\`
- **Error / Reason**: \`${entry.reason}\`
- **Affected rules**: ${entry.ruleIds.map((id) => `\`${id}\``).join(", ")}

## Context & Contribution Guide

This is a **good first issue** for community contributors.

### How to fix:
1. Locate where this evidence moved:
   - Check the vendor's updated documentation or migration guide.
   - Or find an archived snapshot on [Wayback Machine (archive.org)](https://web.archive.org/).
2. Confirm the new page documents the lifecycle status and version constraints.
3. Update \`sources\` in \`registry/<ecosystem>.json\` with the new URL (or add an \`archiveUrl\`).
4. Update \`provenance.reviewedAt\` to today and verify with \`npm run check\`.
5. Open a pull request!
`;
  return {
    url: entry.url,
    ruleIds: entry.ruleIds,
    reason: entry.reason,
    title,
    body,
    labels: DEAD_SOURCE_LABELS,
  };
}

export interface IssueRecord {
  number?: number;
  title: string;
  body: string;
  state?: string;
}

export interface IssueRunner {
  listExisting(repo?: string): Promise<IssueRecord[]>;
  createIssue(issue: { title: string; body: string; labels: string[] }, repo?: string): Promise<number>;
  updateIssue?(issueNumber: number, update: { body: string }, repo?: string): Promise<void>;
  closeIssue?(issueNumber: number, comment: string, repo?: string): Promise<void>;
}

export const defaultGitHubRunner: IssueRunner = {
  async listExisting(repo?: string): Promise<IssueRecord[]> {
    const args = ["issue", "list", "--json", "number,title,body,state", "--limit", "100"];
    if (repo) args.push("--repo", repo);
    const { stdout } = await execFileAsync("gh", args);
    return JSON.parse(stdout || "[]") as IssueRecord[];
  },
  async createIssue(issue: { title: string; body: string; labels: string[] }, repo?: string): Promise<number> {
    const args = ["issue", "create", "--title", issue.title, "--body", issue.body];
    for (const label of issue.labels) args.push("--label", label);
    if (repo) args.push("--repo", repo);
    const { stdout } = await execFileAsync("gh", args);
    const match = stdout.match(/\/issues\/(\d+)/);
    return match ? Number(match[1]) : 0;
  },
  async updateIssue(issueNumber: number, update: { body: string }, repo?: string): Promise<void> {
    const args = ["issue", "edit", String(issueNumber), "--body", update.body];
    if (repo) args.push("--repo", repo);
    await execFileAsync("gh", args);
  },
  async closeIssue(issueNumber: number, comment: string, repo?: string): Promise<void> {
    const args = ["issue", "close", String(issueNumber), "--comment", comment];
    if (repo) args.push("--repo", repo);
    await execFileAsync("gh", args);
  },
};

export async function openDeadSourceIssues(
  report: SourceReport,
  runner: IssueRunner = defaultGitHubRunner,
  options: {
    maxOpen?: number | undefined;
    repo?: string | undefined;
    dryRun?: boolean | undefined;
    lock?: SourceLock | undefined;
    now?: Date | undefined;
  } = {},
): Promise<{ opened: DeadSourceIssue[]; updated: DeadSourceIssue[]; closed: number[]; skipped: string[] }> {
  const maxOpen = options.maxOpen ?? 10;
  const existing = await runner.listExisting(options.repo);
  const trackedIssues = new Map<string, IssueRecord>();
  let openCount = 0;
  for (const issue of existing) {
    const hash = extractDeadSourceHash(issue.body);
    if (hash) {
      if (!issue.state || issue.state.toUpperCase() === "OPEN") {
        trackedIssues.set(hash, issue);
        openCount++;
      }
    }
  }

  const opened: DeadSourceIssue[] = [];
  const updated: DeadSourceIssue[] = [];
  const closed: number[] = [];
  const skipped: string[] = [];

  const currentUnreachableHashes = new Set(
    report.unreachable.map((entry) => createHash("sha256").update(entry.url).digest("hex").slice(0, 16)),
  );

  // Close issues when the problem is gone (Sub-issue 6)
  for (const [hash, issue] of trackedIssues.entries()) {
    if (!currentUnreachableHashes.has(hash)) {
      if (runner.closeIssue && issue.number) {
        if (!options.dryRun) {
          await runner.closeIssue(
            issue.number,
            "Evidence source is now reachable; closing automatic issue.",
            options.repo,
          );
        }
        closed.push(issue.number);
        openCount--;
      }
    }
  }

  const nowTime = options.now ?? new Date();

  // Open or update issues for current unreachable sources
  for (const entry of report.unreachable) {
    const hash = createHash("sha256").update(entry.url).digest("hex").slice(0, 16);
    const existingIssue = trackedIssues.get(hash);
    const rendered = renderDeadSourceIssue(entry);

    if (existingIssue) {
      if (runner.updateIssue && existingIssue.number) {
        if (!options.dryRun) {
          await runner.updateIssue(existingIssue.number, { body: rendered.body }, options.repo);
        }
        updated.push(rendered);
      } else {
        skipped.push(entry.url);
      }
      continue;
    }

    // Sub-issue 3: Do not open issue on single failure. Wait for second failure >= 24h later.
    if (options.lock) {
      const lockEntry = options.lock.sources[entry.url];
      if (!lockEntry || !lockEntry.firstFailedAt) {
        if (lockEntry) {
          lockEntry.firstFailedAt = nowTime.toISOString();
        }
        skipped.push(entry.url);
        continue;
      }
      const firstFailed = new Date(lockEntry.firstFailedAt);
      const hoursSinceFirstFail = (nowTime.getTime() - firstFailed.getTime()) / (1000 * 60 * 60);
      if (hoursSinceFirstFail < 24) {
        skipped.push(entry.url);
        continue;
      }
    }

    if (openCount >= maxOpen) {
      break;
    }

    if (!options.dryRun) {
      await runner.createIssue(rendered, options.repo);
    }
    opened.push(rendered);
    trackedIssues.set(hash, { title: rendered.title, body: rendered.body });
    openCount++;
  }

  return { opened, updated, closed, skipped };
}

/** Proposes lock file updates for verified, unchanged sources (Sub-issue 7). */
export async function proposeDateBumps(
  report: SourceReport,
  lock: SourceLock,
  observations: Map<string, SourceObservation>,
  now: Date,
  lockPath: string,
  options: { dryRun?: boolean | undefined; repo?: string | undefined } = {},
): Promise<{ bumpedCount: number; message: string }> {
  const problemUrls = new Set<string>([
    ...report.unreachable.map((e) => e.url),
    ...report.changed.map((e) => e.url),
    ...report.blocked.map((e) => e.url),
    ...report.unrecorded.map((e) => e.url),
    ...(report["date-missing"] ?? []).map((e) => e.url),
    ...(report["date-changed"] ?? []).map((e) => e.url),
    ...(report["archived-only"] ?? []).map((e) => e.url),
  ]);

  const candidates: Array<{ url: string; oldDate: string; newDate: string }> = [];
  const todayStr = now.toISOString().slice(0, 10);

  for (const [url, entry] of Object.entries(lock.sources)) {
    if (!problemUrls.has(url)) {
      const obs = observations.get(url);
      if (obs && obs.status !== null && obs.status >= 200 && obs.status < 300 && obs.finalUrl) {
        if (entry.checkedAt !== todayStr) {
          candidates.push({ url, oldDate: entry.checkedAt, newDate: todayStr });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { bumpedCount: 0, message: "Nothing to bump." };
  }

  const newLock = updatedLock(lock, observations, now, report);
  if (!options.dryRun) {
    await writeFile(lockPath, `${JSON.stringify(newLock, null, 2)}\n`);
  }

  const prBody = [
    "## Source date bumps",
    "",
    `Verified ${candidates.length} sources on ${todayStr}. All sources are reachable, unchanged, and dates verified.`,
    "",
    "| Source URL | Checked |",
    "|---|---|",
    ...candidates.map((c) => `| \`${c.url}\` | ${c.newDate} (was ${c.oldDate}) |`),
    "",
    "> Note: `provenance.reviewedAt` was not changed; a machine check is not a human review.",
  ].join("\n");

  if (!options.dryRun) {
    try {
      const branch = `sources/bump-${todayStr}`;
      await execFileAsync("git", ["checkout", "-b", branch]);
      await execFileAsync("git", ["add", lockPath]);
      await execFileAsync("git", ["commit", "-m", `data: bump verified source dates for ${todayStr}`]);
      await execFileAsync("git", ["push", "-u", "origin", branch]);
      const prArgs = [
        "pr",
        "create",
        "--title",
        `data: source date bumps for ${todayStr}`,
        "--body",
        prBody,
        "--head",
        branch,
      ];
      if (options.repo) prArgs.push("--repo", options.repo);
      const { stdout } = await execFileAsync("gh", prArgs);
      return { bumpedCount: candidates.length, message: `Opened PR: ${stdout.trim()}` };
    } catch (err) {
      return { bumpedCount: candidates.length, message: `Created branch with bumps: ${(err as Error).message}` };
    }
  }

  return { bumpedCount: candidates.length, message: `Dry run: ${candidates.length} sources to bump.` };
}

export async function loadRegistries(directory: string): Promise<{ name: string; registry: RegistryV2 }[]> {
  const registries: { name: string; registry: RegistryV2 }[] = [];
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith(".json") && !name.startsWith("sources."))
    .sort()) {
    const value = JSON.parse(await readFile(join(directory, file), "utf8")) as { schemaVersion?: string };
    if (value.schemaVersion === REGISTRY_V2_SCHEMA_VERSION)
      registries.push({ name: file.replace(/\.json$/, ""), registry: validateRegistryV2(value) });
  }
  return registries;
}

async function loadLock(path: string): Promise<SourceLock> {
  try {
    const lock = JSON.parse(await readFile(path, "utf8")) as SourceLock;
    if (lock.schemaVersion !== SOURCE_LOCK_SCHEMA)
      throw new Error(`Unsupported source lock: ${String(lock.schemaVersion)}`);
    return lock;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: SOURCE_LOCK_SCHEMA, sources: {} };
    throw error;
  }
}

export async function main(argv: string[]): Promise<number> {
  const options = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument "${argument}".`);
    if (
      argument === "--update-lock" ||
      argument === "--open-issues" ||
      argument === "--dry-run" ||
      argument === "--propose-pr"
    )
      flags.add(argument);
    else
      options.set(
        argument,
        argv[++index] ??
          (() => {
            throw new Error(`${argument} needs a value.`);
          })(),
      );
  }
  const directory = resolve(options.get("--registry-dir") ?? "registry");
  const lockPath = resolve(options.get("--lock") ?? join(directory, "sources.lock.json"));
  const failOn = (options.get("--fail-on") ?? "").split(",").filter(Boolean) as FailCategory[];
  for (const category of failOn)
    if (!["stale", "changed", "unreachable", "date-missing", "date-changed", "archived-only"].includes(category))
      throw new Error(`Unknown --fail-on category "${category}".`);
  const now = options.has("--now") ? new Date(options.get("--now")!) : new Date();

  const lock = await loadLock(lockPath);
  const timeout = Number(options.get("--timeout") ?? 15_000);
  const { report, observations } = await checkSources({
    registries: await loadRegistries(directory),
    lock,
    now,
    observe: (url) => fetchObservation(url, timeout, 2, undefined, true),
    concurrency: Number(options.get("--concurrency") ?? 4),
  });

  if (options.has("--out")) await writeFile(options.get("--out")!, `${JSON.stringify(report, null, 2)}\n`);
  const summary = renderSummary(report);
  if (options.has("--summary")) await writeFile(options.get("--summary")!, summary, { flag: "a" });
  else process.stdout.write(summary);
  if (flags.has("--update-lock")) {
    await writeFile(lockPath, `${JSON.stringify(updatedLock(lock, observations, now, report), null, 2)}\n`);
    process.stdout.write(`Updated ${lockPath}\n`);
  }
  if (flags.has("--open-issues")) {
    const maxOpen = Number(options.get("--max-open-issues") ?? 10);
    const repo = options.get("--repo");
    const dryRun = flags.has("--dry-run");
    const { opened, updated, closed, skipped } = await openDeadSourceIssues(report, defaultGitHubRunner, {
      maxOpen,
      ...(repo !== undefined ? { repo } : {}),
      dryRun,
      lock,
      now,
    });
    process.stdout.write(
      `Opened ${opened.length}, updated ${updated.length}, closed ${closed.length} dead source issues (${skipped.length} skipped)\n`,
    );
  }
  if (flags.has("--propose-pr")) {
    const res = await proposeDateBumps(report, lock, observations, now, lockPath, {
      dryRun: flags.has("--dry-run"),
      repo: options.get("--repo"),
    });
    process.stdout.write(`${res.message}\n`);
  }

  const failing = failingCategories(report, failOn);
  if (failing.length > 0) process.stderr.write(`Needs review: ${failing.join(", ")}\n`);
  return failing.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exit(2);
    },
  );
}
