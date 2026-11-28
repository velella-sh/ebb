import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { BaseOs, CodenameRow, ImageVariantTable, ImageVariantRow } from "../../src/image-variants.js";
import type { RegistryV2 } from "../../src/registry.js";
import { isoDate } from "./canonical.js";
import { fetchJson, type ImporterContext, type ImageVariantsImporter } from "./types.js";

export type { CodenameRow } from "../../src/image-variants.js";

const repository = "https://github.com/docker-library/official-images";
const rawRepository = "https://raw.githubusercontent.com/docker-library/official-images";
const imageName = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
const commitId = /^[0-9a-f]{40}$/;
const tagName = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const architectureName = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

function osForDirectory(
  name: string,
  directory: string,
  gitFetch: string,
  codenames: readonly CodenameRow[],
): BaseOs | undefined {
  const parts = directory.replace(/\/$/, "").split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) return undefined;
  const leaf = parts.at(-1) ?? "";
  const variant =
    name === "drupal"
      ? leaf.replace(/^(?:apache|fpm)-/, "")
      : name === "mariadb"
        ? leaf.replace(/^\d+\.\d+-([a-z]+)$/, "$1")
        : leaf;
  const alpine =
    /^alpine([1-9]\d*\.\d+)$/.exec(variant) ??
    (name === "alpine" ? /^refs\/heads\/v([1-9]\d*\.\d+)$/.exec(gitFetch) : null);
  if (alpine) return { family: "alpine", version: alpine[1]!, codename: null, purl: "pkg:generic/alpine" };
  // Base-distribution images identify the release in their artifact directory or ref.
  const codename =
    name === "ubuntu" && leaf === "oci"
      ? /^refs\/tags\/dist-([a-z][a-z0-9]+)-[a-z0-9]+-\d+(?:\.\d+)?-[a-f0-9]+$/.exec(gitFetch)?.[1]
      : name === "debian" && leaf === "oci"
        ? parts.at(-2)
        : variant.replace(/^slim-|-slim$/g, "");
  if (!codename) return undefined;
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
): Promise<ImageVariantTable> {
  if (!imageName.test(name) || !commitId.test(commit))
    throw new Error("Expected an official image name and full Git SHA.");
  const path = `library/${name}`;
  const text = await context.fetchText(`${rawRepository}/${commit}/${path}`);
  return { schemaVersion: "ebb.image-variants.v1", rows: rowsFromLibrary(text, name, commit, codenames) };
}

function rowsFromLibrary(
  text: string,
  name: string,
  commit: string,
  codenames: readonly CodenameRow[],
): ImageVariantRow[] {
  const path = `library/${name}`;
  const [defaults, ...entries] = parseFields(text);
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
          : osForDirectory(
              name,
              value(`${arch}-directory`) ?? value("directory") ?? "",
              value(`${arch}-gitfetch`) ?? value("gitfetch") ?? "",
              codenames,
            ),
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
  return rows;
}

const registryDir = new URL("../../../registry/", import.meta.url);

/** Draft a snapshot of all official images named by the registry. */
export const imageVariantsImporter: ImageVariantsImporter = {
  format: "image-variants",
  id: "image-variants",
  ecosystem: "image-variants",
  description: "Base distributions declared in Docker Official Images library files",
  async import(context) {
    const [container, codenames, head, previous] = await Promise.all([
      readFile(new URL("container.json", registryDir), "utf8").then((text) => JSON.parse(text) as RegistryV2),
      readFile(new URL("tables/codenames.json", registryDir), "utf8").then(
        (text) => JSON.parse(text) as { rows: CodenameRow[] },
      ),
      fetchJson<{ sha: string }>(context, "https://api.github.com/repos/docker-library/official-images/commits/master"),
      readImageVariants(new URL("tables/", registryDir)),
    ]);
    const commit = head.sha;
    if (!commitId.test(commit)) throw new Error("Official Images HEAD did not contain a full Git SHA.");
    const names = [
      ...new Set(container.rules.flatMap(({ purl }) => /^pkg:docker\/library\/([a-z0-9._-]+)$/.exec(purl)?.[1] ?? [])),
    ].sort();
    const entries = await Promise.all(
      names.map(async (name) => {
        const path = `library/${name}`;
        let text: string;
        try {
          text = await context.fetchText(`${rawRepository}/${commit}/${path}`);
        } catch (error) {
          if ((error as Error).message.endsWith("HTTP 404")) {
            return { path, sha256: null, rows: [], note: `${name}: no upstream library file.` };
          }
          throw error;
        }
        const rows = rowsFromLibrary(text, name, commit, codenames.rows);
        return {
          path,
          sha256: createHash("sha256").update(text).digest("hex"),
          rows,
          note: rows.length ? undefined : `${name}: no unambiguous supported distribution in library metadata.`,
        };
      }),
    );
    const verified = new Map(
      previous?.rows.filter((row) => row.digests).map((row) => [`${row.imagePurl}@${row.tag}`, row]),
    );
    const rows = entries.flatMap((entry) =>
      entry.rows.map((row) => {
        const old = verified.get(`${row.imagePurl}@${row.tag}`);
        if (
          old?.digests &&
          old.baseOs.purl === row.baseOs.purl &&
          old.baseOs.version === row.baseOs.version &&
          old.architectures.join(",") === row.architectures.join(",")
        ) {
          return { ...row, digests: old.digests };
        }
        return row;
      }),
    );
    return {
      table: {
        schemaVersion: "ebb.image-variants.v1",
        snapshot: {
          commit,
          accessedAt: isoDate(context.now),
          files: Object.fromEntries(entries.map(({ path, sha256 }) => [path, sha256])),
        },
        rows,
      },
      notes: entries.flatMap(({ note }) => note ?? []),
    };
  },
};

export async function readImageVariants(tableDir: URL): Promise<ImageVariantTable | undefined> {
  try {
    return JSON.parse(await readFile(new URL("image-variants.json", tableDir), "utf8")) as ImageVariantTable;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
