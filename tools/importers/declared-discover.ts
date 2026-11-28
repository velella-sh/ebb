import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { DECLARED_CANDIDATES } from "./declared-candidates.js";
import { readRecording, recordingContext, replayContext, writeRecording } from "./recording.js";
import { ImporterError, fetchJson } from "./types.js";
import type { ImporterContext } from "./types.js";

// Proposed stable URL in #870 and #939. Discovery does not fetch or validate the schema.
export const DECLARATION_SCHEMA_URL = "https://velella.sh/ebb/schemas/lifecycle/1.0/declaration.schema.json";
const endpoint = "https://api.github.com/search/code";
const importer = "declared-discover";
const pageSize = 30;

interface SearchPage {
  repositoryIds: number[];
  incomplete: boolean;
  hasMore: boolean;
}

const isRepositoryId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

export function searchUrl(schemaUrl: string, page: number): string {
  const schema = new URL(schemaUrl);
  if (
    schema.protocol !== "https:" ||
    schema.username ||
    schema.password ||
    schema.search ||
    schema.hash ||
    /[\s"]/u.test(schemaUrl)
  ) {
    throw new ImporterError("Use an HTTPS schema URL without credentials, a query or a fragment.");
  }
  if (!Number.isInteger(page) || page < 1 || page > Math.ceil(1000 / pageSize)) {
    throw new ImporterError("Use a GitHub code-search page from 1 to 34.");
  }
  const query = new URLSearchParams({ q: `"${schema.href}" in:file`, per_page: String(pageSize), page: String(page) });
  return `${endpoint}?${query}`;
}

/** Keep only the public repository IDs and pagination signals before anything can be recorded. */
export function publicSearchPage(value: unknown, page: number): SearchPage {
  const response = value as {
    total_count?: unknown;
    incomplete_results?: unknown;
    items?: { repository?: { id?: unknown; private?: unknown } }[];
  } | null;
  if (
    !response ||
    typeof response.total_count !== "number" ||
    !Number.isSafeInteger(response.total_count) ||
    response.total_count < 0 ||
    typeof response.incomplete_results !== "boolean" ||
    !Array.isArray(response.items)
  ) {
    throw new ImporterError("GitHub code search returned an invalid response.");
  }
  const repositoryIds: number[] = [];
  for (const item of response.items) {
    const repo = item?.repository;
    if (repo?.private === false && isRepositoryId(repo.id)) repositoryIds.push(repo.id);
  }
  return {
    repositoryIds: [...new Set(repositoryIds)].sort((a, b) => a - b),
    incomplete: response.incomplete_results,
    hasMore: Math.min(1000, response.total_count) > pageSize * page,
  };
}

export async function discoverDeclarations(context: ImporterContext, schemaUrl = DECLARATION_SCHEMA_URL, page = 1) {
  const result = await fetchJson<SearchPage>(context, searchUrl(schemaUrl, page));
  if (
    !result ||
    typeof result.incomplete !== "boolean" ||
    typeof result.hasMore !== "boolean" ||
    !Array.isArray(result.repositoryIds) ||
    !result.repositoryIds.every(isRepositoryId)
  ) {
    throw new ImporterError("Invalid recorded GitHub code search response.");
  }
  const known = new Set(DECLARED_CANDIDATES.map((candidate) => candidate.githubRepositoryId));
  const candidates = [...new Set(result.repositoryIds)]
    .sort((a, b) => a - b)
    .filter((id) => !known.has(id))
    .map((id) => `https://api.github.com/repositories/${id}`);
  return { schemaUrl, page, candidates, incomplete: result.incomplete, hasMore: result.hasMore };
}

function liveSearch(token: string): ImporterContext {
  return {
    now: new Date(),
    async fetchText(url) {
      const request = new URL(url);
      if (`${request.origin}${request.pathname}` !== endpoint || request.username || request.password) {
        throw new ImporterError("The GitHub token can only be used for GitHub code search.");
      }
      const response = await fetch(request, {
        redirect: "error",
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const limited = response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0";
        throw new ImporterError(`GitHub code search failed: HTTP ${response.status}${limited ? " (rate limit)" : ""}.`);
      }
      return JSON.stringify(publicSearchPage(await response.json(), Number(request.searchParams.get("page"))));
    },
  };
}

export async function main(args: string[], token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN) {
  const { values } = parseArgs({
    args,
    options: {
      record: { type: "string" },
      replay: { type: "string" },
      "schema-url": { type: "string" },
      page: { type: "string" },
    },
  });
  const schema = values["schema-url"] ?? DECLARATION_SCHEMA_URL;
  const page = values.page === undefined ? 1 : Number(values.page);
  const discover = (context: ImporterContext) => discoverDeclarations(context, schema, page);
  if (values.record !== undefined && values.replay !== undefined) throw new ImporterError("Use --record or --replay.");
  if (values.replay !== undefined) {
    const recording = await readRecording(values.replay);
    if (recording.importer !== importer) throw new ImporterError(`Expected a ${importer} recording.`);
    return discover(replayContext(recording));
  }
  if (!token) throw new ImporterError("Set GH_TOKEN to the GitHub workflow token, or use --replay.");
  const context = liveSearch(token);
  if (values.record === undefined) return discover(context);
  const recorder = recordingContext(context);
  const report = await discover(recorder.context);
  await writeRecording(values.record, recorder.recording(importer));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await main(process.argv.slice(2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
