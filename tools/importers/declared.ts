import { isValidStrictSemver } from "../../src/vers/semver.js";
import { DECLARED_CANDIDATES } from "./declared-candidates.js";
import type { DeclaredCandidate } from "./declared-candidates.js";
import { NPM_NAME, registryUrl } from "./npm.js";
import { ImporterError, fetchJson } from "./types.js";
import type { ImporterContext } from "./types.js";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export interface NpmDeclaration {
  package: string;
  version: string;
  source: string;
  commit?: string;
  /** Unvalidated maintainer input for the next stage of the importer. */
  declaration: JsonObject;
}

/** Accept relative file paths only. Construct the URL from encoded segments below. */
function segments(path: string): string[] | undefined {
  if (/[\\:%?#\p{Cc}]/u.test(path)) return undefined;
  const parts = path.replace(/^\.\//u, "").split("/");
  return parts.every((part) => part && part !== "." && part !== "..") ? parts : undefined;
}

function pinnedFile(manifest: JsonObject, path: string) {
  const commit = manifest.gitHead;
  if (typeof commit !== "string" || !/^[a-f0-9]{40}$/iu.test(commit)) return undefined;

  const repo = manifest.repository;
  const url = typeof repo === "string" ? repo : isObject(repo) ? repo.url : undefined;
  if (typeof url !== "string") return undefined;
  const slug =
    /^(?:github:|(?:git\+)?https:\/\/github\.com\/|(?:git\+)?ssh:\/\/git@github\.com\/|git@github\.com:)([a-z\d](?:[a-z\d-]*[a-z\d])?\/[a-z\d_.-]+?)(?:\.git)?\/?$/iu.exec(
      url,
    )?.[1];
  if (!slug || slug.endsWith("/.") || slug.endsWith("/..")) return undefined;

  const directory = isObject(repo) ? repo.directory : undefined;
  const prefix =
    directory === undefined || directory === "" || directory === "."
      ? []
      : typeof directory === "string"
        ? segments(directory.replace(/\/$/u, ""))
        : undefined;
  const file = path.endsWith(".json") ? segments(path) : undefined;
  if (!prefix || !file) return undefined;

  const encoded = [...prefix, ...file].map(encodeURIComponent).join("/");
  return {
    commit: commit.toLowerCase(),
    source: `https://raw.githubusercontent.com/${slug}/${commit.toLowerCase()}/${encoded}`,
  };
}

const notFound = (error: unknown) => error instanceof ImporterError && /HTTP 404\b/u.test(error.message);

/** Read the latest npm package metadata, and retrieve relative files only at the published commit. */
export async function readNpmDeclarations(
  context: ImporterContext,
  candidates: readonly Pick<DeclaredCandidate, "ecosystem" | "name">[] = DECLARED_CANDIDATES,
): Promise<{ declarations: NpmDeclaration[]; notes: string[] }> {
  const declarations: NpmDeclaration[] = [];
  const notes: string[] = [];

  for (const { ecosystem, name } of candidates) {
    if (ecosystem !== "npm") continue;
    if (!NPM_NAME.test(name)) {
      notes.push(`Skipped ${name}: invalid npm package name.`);
      continue;
    }
    const metadata = registryUrl(name);
    let latest: unknown;
    try {
      latest = await fetchJson<unknown>(context, metadata);
    } catch (error) {
      if (!notFound(error)) throw error;
      notes.push(`Skipped ${name}: not found in the npm registry.`);
      continue;
    }
    if (
      !isObject(latest) ||
      latest.name !== name ||
      typeof latest.version !== "string" ||
      !isValidStrictSemver(latest.version)
    ) {
      throw new ImporterError(`Invalid latest npm manifest for ${name}.`);
    }

    const { version, lifecycle } = latest;
    if (lifecycle === undefined) continue;
    if (isObject(lifecycle)) {
      declarations.push({ package: name, version, source: metadata, declaration: lifecycle });
      continue;
    }
    if (typeof lifecycle !== "string") {
      notes.push(`Skipped ${name}@${version}: lifecycle must be an object or a relative JSON path.`);
      continue;
    }
    const pinned = pinnedFile(latest, lifecycle);
    if (!pinned) {
      notes.push(
        `Skipped ${name}@${version}: cannot pin the declaration to a public GitHub repository, full gitHead and relative JSON path.`,
      );
      continue;
    }

    let body: string;
    try {
      body = await context.fetchText(pinned.source);
    } catch (error) {
      if (!notFound(error)) throw error;
      notes.push(`Skipped ${name}@${version}: declaration unavailable at published commit ${pinned.commit}.`);
      continue;
    }
    let declaration: unknown;
    try {
      declaration = JSON.parse(body) as unknown;
    } catch {
      // Invalid declaration data is a note. Connection and service failures still fail the run.
    }
    if (!isObject(declaration)) {
      notes.push(`Skipped ${name}@${version}: the pinned file must contain a JSON object.`);
      continue;
    }
    declarations.push({ package: name, version, ...pinned, declaration });
  }
  return { declarations, notes };
}
