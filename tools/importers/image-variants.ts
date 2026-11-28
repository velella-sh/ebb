import type { ImporterContext } from "./types.js";

const repository = "https://github.com/docker-library/official-images";
const rawRepository = "https://raw.githubusercontent.com/docker-library/official-images";
const imageName = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
const commitId = /^[0-9a-f]{40}$/;
const tagName = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const architectureName = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Family = "debian" | "ubuntu" | "nodejs-lts";
type OsFamily = Exclude<Family, "nodejs-lts"> | "alpine";

export interface CodenameRow {
  family: Family;
  codename: string;
  version: string;
  source: { url: string; accessedAt: string };
}

interface BaseOs {
  family: OsFamily;
  version: string;
  codename: string | null;
  purl: `pkg:generic/${OsFamily}`;
}

interface ImageVariantRow {
  imagePurl: string;
  tag: string;
  sharedTags: string[];
  architectures: string[];
  baseOs: BaseOs;
  source: { repository: string; commit: string; path: string };
}

interface Claim {
  baseOs: BaseOs | undefined;
  architectures: string[];
  sharedTags: string[];
}

function parseFields(text: string): Map<string, string>[] {
  const entries: Map<string, string>[] = [];
  let entry = new Map<string, string>();
  let previousField = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#")) continue;
    if (!line.trim()) {
      if (entry.size) entries.push(entry);
      entry = new Map();
      previousField = "";
      continue;
    }
    if (/^\s/.test(line) && previousField) {
      entry.set(previousField, `${entry.get(previousField)} ${line.trim()}`);
      continue;
    }
    const field = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`Invalid Docker library field: ${line}`);
    const key = field[1]!.toLowerCase();
    if (entry.has(key)) throw new Error(`Repeated Docker library field: ${key}`);
    entry.set(key, field[2]!.trim());
    previousField = key;
  }
  if (entry.size) entries.push(entry);
  return entries;
}

function fieldList(value: string | undefined, pattern: RegExp): string[] {
  if (value === undefined) return [];
  const items = value.split(",").map((item) => item.trim());
  if (items.some((item) => !pattern.test(item))) throw new Error(`Invalid Docker library list: ${value}`);
  return items;
}

function osForDirectory(directory: string, codenames: readonly CodenameRow[]): BaseOs | undefined {
  const parts = directory.replace(/\/$/, "").split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) return undefined;
  const leaf = parts.at(-1) ?? "";
  const alpine = /^alpine([1-9]\d*\.\d+)$/.exec(leaf);
  if (alpine) return { family: "alpine", version: alpine[1]!, codename: null, purl: "pkg:generic/alpine" };
  const codename = leaf.replace(/^slim-|-slim$/g, "");
  const matches = codenames.filter((row) => row.family !== "nodejs-lts" && row.codename === codename);
  const match = matches[0];
  if (matches.length !== 1 || !match || match.family === "nodejs-lts") return undefined;
  return { family: match.family, version: match.version, codename, purl: `pkg:generic/${match.family}` };
}

function commonOs(claims: readonly (BaseOs | undefined)[]): BaseOs | undefined {
  const first = claims[0];
  if (first && claims.every((os) => os?.family === first.family && os.version === first.version)) return first;
  return undefined;
}

/** Read one Docker library definition at a full, immutable official-images commit. */
export async function importImageVariants(
  context: Pick<ImporterContext, "fetchText">,
  name: string,
  commit: string,
  codenames: readonly CodenameRow[],
): Promise<{ schemaVersion: "ebb.image-variants.v1"; rows: ImageVariantRow[] }> {
  if (!imageName.test(name) || !commitId.test(commit))
    throw new Error("Expected an official image name and full Git SHA.");
  const path = `library/${name}`;
  const [defaults, ...entries] = parseFields(await context.fetchText(`${rawRepository}/${commit}/${path}`));
  if (!defaults?.has("maintainers") || !entries.length) throw new Error(`Missing Docker library metadata in ${path}.`);

  const claimsByTag = new Map<string, Claim[]>();
  for (const entry of entries) {
    const value = (key: string) => entry.get(key) ?? defaults.get(key);
    const tags = fieldList(value("tags"), tagName);
    const sharedTags = fieldList(value("sharedtags"), tagName);
    const architectures = fieldList(value("architectures") ?? "amd64", architectureName);
    if (!tags.length) throw new Error(`Missing Tags in ${path}.`);
    const baseOs = commonOs(
      architectures.map((arch) =>
        arch.startsWith("windows-")
          ? undefined
          : osForDirectory(value(`${arch}-directory`) ?? value("directory") ?? "", codenames),
      ),
    );
    for (const tag of new Set([...tags, ...sharedTags])) {
      const claims = claimsByTag.get(tag) ?? [];
      claims.push({ baseOs, architectures, sharedTags });
      claimsByTag.set(tag, claims);
    }
  }

  const rows: ImageVariantRow[] = [];
  for (const tag of [...claimsByTag.keys()].sort()) {
    const claims = claimsByTag.get(tag)!;
    const baseOs = commonOs(claims.map((claim) => claim.baseOs));
    if (!baseOs) continue;
    rows.push({
      imagePurl: `pkg:docker/library/${name}`,
      tag,
      sharedTags: [...new Set(claims.flatMap((claim) => claim.sharedTags))].filter((alias) => alias !== tag).sort(),
      architectures: [...new Set(claims.flatMap((claim) => claim.architectures))].sort(),
      baseOs,
      source: { repository, commit, path },
    });
  }
  return { schemaVersion: "ebb.image-variants.v1", rows };
}
