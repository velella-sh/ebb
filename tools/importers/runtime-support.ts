import { readFile } from "node:fs/promises";
import type { CompatibilityRow, CompatibilityTable } from "../../src/compat.js";
import { parsePurl, purlIdentity } from "../../src/purl.js";
import { fileURLToPath } from "node:url";
import { formatVers, type VersConstraint, versionScheme } from "../../src/vers.js";
import { loadRegistries } from "../check-sources.js";
import { isoDate } from "./canonical.js";
import { nodeEnginesVers, requiresPythonVers } from "./compat-ranges.js";
import { fetchJson, type ImporterContext, type CompatibilityImporterOutput } from "./types.js";

const schema = "https://velella.sh/ebb/api/v1/schemas/compat.v1.schema.json";
const tableDir = new URL("../../../registry/tables/", import.meta.url);
async function subjectsFromRegistry(): Promise<string[]> {
  const [registries, documented] = await Promise.all([
    loadRegistries(fileURLToPath(new URL("..", tableDir))),
    readFile(new URL("runtime-support.compat.json", tableDir), "utf8"),
  ]);
  const rows = (JSON.parse(documented) as CompatibilityTable).rows;
  return [
    ...new Set([
      ...registries.flatMap(({ registry }) => registry.rules.map(({ purl }) => purlIdentity(purl))),
      ...rows.map(({ subject }) => subject),
    ]),
  ]
    .filter((purl) => /^(?:pkg:npm|pkg:pypi)\//.test(purl))
    .sort();
}

function evidenceFor(subject: string) {
  const { type, namespace, name } = parsePurl(subject);
  if (type === "npm") {
    const packageName = namespace ? `${namespace}/${name}` : name;
    return { url: `https://registry.npmjs.org/${encodeURIComponent(packageName)}`, name: packageName };
  }
  return { url: `https://pypi.org/pypi/${encodeURIComponent(name)}/json`, name };
}

interface NpmMetadata {
  versions: Record<string, { engines?: { node?: unknown } }>;
}
interface PyPiMetadata {
  releases: Record<string, readonly { requires_python?: unknown }[]>;
}

async function readPackage(
  context: ImporterContext,
  subject: string,
): Promise<{ rows: CompatibilityRow[]; notes: string[] }> {
  const { url, name } = evidenceFor(subject);
  const npm = subject.startsWith("pkg:npm/");
  const subjectScheme = npm ? "npm" : "pypi";
  const runtimePurl = npm ? "pkg:generic/nodejs" : "pkg:generic/python";
  const compare = versionScheme(subjectScheme).compare;
  let observed: [string, unknown[]][];
  try {
    if (npm) {
      const metadata = await fetchJson<NpmMetadata>(context, url);
      observed = Object.entries(metadata.versions).map(([release, manifest]) => [release, [manifest.engines?.node]]);
    } else {
      const metadata = await fetchJson<PyPiMetadata>(context, url);
      observed = Object.entries(metadata.releases).map(([release, files]) => [
        release,
        files.map((file) => file.requires_python),
      ]);
    }
  } catch (error) {
    if (/HTTP 404\b/.test((error as Error).message)) return { rows: [], notes: [`${subject}: registry returned 404.`] };
    throw error;
  }

  const groups = new Map<string, string[]>();
  const skipped = new Map<string, number>();
  const source = {
    url,
    title: `${name} ${npm ? "npm engines.node" : "PyPI Requires-Python"} metadata`,
    accessedAt: isoDate(context.now),
  };
  function skip(reason: string) {
    skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  }
  const releases: { version: string; range: string | undefined }[] = [];
  for (const [version, values] of observed) {
    try {
      compare(version, version);
    } catch {
      skip("release version could not be ordered");
      continue;
    }

    let range: string | undefined;
    const declarations = new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")));
    const [raw] = declarations;
    if (declarations.size > 1) skip("distributions disagreed on Requires-Python");
    else if (!raw) skip("no runtime range was declared");
    else {
      try {
        range = npm ? nodeEnginesVers(raw) : requiresPythonVers(raw);
      } catch {
        skip(`could not normalize ${JSON.stringify(raw)}`);
      }
    }
    releases.push({ version, range });
  }

  releases.sort(
    (a, b) => compare(a.version, b.version) || (a.version < b.version ? -1 : a.version > b.version ? 1 : 0),
  );
  for (let index = 0; index < releases.length; ) {
    const current = releases[index]!;
    let end = index + 1;
    while (end < releases.length && compare(current.version, releases[end]!.version) === 0) end++;
    const equivalent = releases.slice(index, end);
    if (equivalent.every(({ range }) => range === current.range)) {
      if (current.range) {
        const versions = groups.get(current.range) ?? [];
        versions.push(current.version);
        groups.set(current.range, versions);
      }
    } else {
      skip("equivalent release versions declared different ranges");
    }
    index = end;
  }

  const rows: CompatibilityRow[] = [...groups].map(([vers, versions]) => ({
    subject,
    subjectVers: formatVers({
      scheme: subjectScheme,
      all: false,
      constraints: versions.map((version): VersConstraint => ({ comparator: "=", version })),
    }),
    requires: [{ purl: runtimePurl, vers }],
    kind: "declared",
    source,
  }));
  const notes = [...skipped].sort().map(([reason, count]) => `${subject}: ${count} releases: ${reason}.`);
  return { rows, notes };
}

/** Read the fixed package list for this checkout. Tests supply a subset backed by a recording. */
export function runtimeSupportImporter(subjects?: readonly string[]) {
  return {
    format: "compatibility" as const,
    id: "runtime-support",
    ecosystem: "runtime-support",
    description: "npm engines.node and PyPI Requires-Python metadata",
    async import(context: ImporterContext): Promise<CompatibilityImporterOutput> {
      const list = subjects ?? (await subjectsFromRegistry());
      const rows: CompatibilityRow[] = [];
      const notes: string[] = [];
      for (let start = 0; start < list.length; start += 8) {
        const batch = await Promise.all(list.slice(start, start + 8).map((subject) => readPackage(context, subject)));
        for (const result of batch) {
          rows.push(...result.rows);
          notes.push(...result.notes);
        }
      }
      const table: CompatibilityTable = { $schema: schema, schemaVersion: "ebb.compat.v1", rows };
      return { table, notes };
    },
  };
}

export async function readDeclaredRuntimeSupport(registryDir?: URL): Promise<CompatibilityTable | undefined> {
  try {
    return JSON.parse(
      await readFile(new URL("runtime-support-declared.compat.json", registryDir ?? tableDir), "utf8"),
    ) as CompatibilityTable;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
