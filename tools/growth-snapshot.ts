/** Record public adoption signals without requiring credentials. */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const repository = "https://github.com/velella-sh/ebb";
const packageName = "@velella/ebb";
const sources = {
  github: "https://api.github.com/repos/velella-sh/ebb",
  githubDependents: repository + "/network/dependents",
  npm: "https://registry.npmjs.org/" + encodeURIComponent(packageName),
  npmDownloads: "https://api.npmjs.org/downloads/point/last-week/" + packageName,
};

type PublicFetch = (url: string) => Promise<Response>;

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function readPublic<T>(fetcher: PublicFetch, url: string, decode: (response: Response) => Promise<T>) {
  try {
    const response = await fetcher(url);
    if (response.ok) return await decode(response);
  } catch {
    // A missing or unreadable source is recorded as null.
  }
  return null;
}

function dependentRepositories(html: string | null): number | null {
  // GitHub's public dependency graph labels this approximate count separately from dependent packages.
  if (!html?.includes(`<strong>${packageName}</strong>`)) return null;
  const match = html.match(
    /href="\/velella-sh\/ebb\/network\/dependents\?dependent_type=REPOSITORY">\s*(?:<svg\b[\s\S]*?<\/svg>\s*)?([\d,]+)\s+Repositor(?:y|ies)\s*<\/a>/u,
  );
  return match?.[1] === undefined ? null : count(Number(match[1].replaceAll(",", "")));
}

export async function growthSnapshot(now: Date, documentedIntegrations: number, fetcher: PublicFetch) {
  const [github, githubDependents, npm, downloads] = await Promise.all([
    readPublic(
      fetcher,
      sources.github,
      (response) => response.json() as Promise<{ stargazers_count?: unknown; forks_count?: unknown }>,
    ),
    readPublic(fetcher, sources.githubDependents, (response) => response.text()),
    readPublic(
      fetcher,
      sources.npm,
      (response) =>
        response.json() as Promise<{
          "dist-tags"?: { latest?: unknown };
          dependents?: unknown;
        }>,
    ),
    readPublic(
      fetcher,
      sources.npmDownloads,
      (response) =>
        response.json() as Promise<{
          downloads?: unknown;
          start?: string;
          end?: string;
        }>,
    ),
  ]);
  const recordedAt = now.toISOString();

  return {
    date: recordedAt.slice(0, 10),
    recordedAt,
    sources,
    stars: count(github?.stargazers_count),
    forks: count(github?.forks_count),
    npmLatest: typeof npm?.["dist-tags"]?.latest === "string" ? npm["dist-tags"].latest : null,
    npmWeeklyDownloads: count(downloads?.downloads),
    npmWeeklyDownloadWindow: downloads?.start && downloads.end ? { start: downloads.start, end: downloads.end } : null,
    githubDependentRepositories: dependentRepositories(githubDependents),
    npmDependentPackages: count(npm?.dependents),
    documentedIntegrations,
  };
}

async function main(args: string[]) {
  const { values } = parseArgs({ args, options: { stdout: { type: "boolean" } } });
  const integrationsFile = new URL("../../metrics/integrations.json", import.meta.url);
  const integrations = JSON.parse(await readFile(integrationsFile, "utf8")) as { status: string }[];
  const snapshot = await growthSnapshot(
    new Date(),
    integrations.filter(({ status }) => status === "documented").length,
    (url) =>
      fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: {
          accept: url.startsWith(repository) ? "text/html" : "application/json",
          "user-agent": "ebb-growth-snapshot",
        },
      }),
  );
  const format = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  if (values.stdout) {
    process.stdout.write(format(snapshot));
    return;
  }
  const history = new URL("../../metrics/releases.json", import.meta.url);
  const entries = JSON.parse(await readFile(history, "utf8")) as unknown[];
  await writeFile(history, format([...entries, snapshot]));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
