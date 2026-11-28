import { readFileSync } from "node:fs";
import { findPackageFileSync } from "./package-files.js";

export type CodenameFamily = "debian" | "ubuntu" | "nodejs-lts";
export type BaseOsFamily = Exclude<CodenameFamily, "nodejs-lts"> | "alpine";

export interface CodenameRow {
  readonly family: CodenameFamily;
  readonly codename: string;
  readonly version: string;
  readonly source: { readonly url: string; readonly accessedAt: string };
}

export interface BaseOs {
  readonly family: BaseOsFamily;
  readonly version: string;
  readonly codename: string | null;
  readonly purl: `pkg:generic/${BaseOsFamily}`;
}

export interface ImageVariantRow {
  readonly imagePurl: string;
  readonly tag: string;
  readonly sharedTags: readonly string[];
  readonly architectures: readonly string[];
  readonly baseOs: BaseOs;
  readonly source: { readonly repository: string; readonly commit: string; readonly path: string };
  readonly digests?: readonly DigestEvidence[];
}

export interface DigestEvidence {
  readonly digest: string;
  readonly url: string;
}

export interface ImageVariantTable {
  readonly schemaVersion: "ebb.image-variants.v1";
  readonly rows: readonly ImageVariantRow[];
  readonly snapshot?: ImageVariantSnapshot;
}

export interface ImageVariantSnapshot {
  readonly commit: string;
  readonly accessedAt: string;
  readonly files: Readonly<Record<string, string | null>>;
}

export type BaseImageResult =
  | { readonly status: "unknown" }
  | (BaseOs & {
      readonly status: "known";
      readonly source: ImageVariantRow["source"];
      readonly digestEvidence?: DigestEvidence;
    });

let variants: Map<string, ImageVariantRow> | undefined;
let codenames: readonly CodenameRow[] | undefined;

function readTable<T>(name: string): T {
  return JSON.parse(readFileSync(findPackageFileSync(`registry/tables/${name}.json`, import.meta.url), "utf8")) as T;
}

/** Resolve an exact tag of an unqualified official image PURL. The tables are loaded on first use. */
export function baseImageOf(purl: string, tag: string): BaseImageResult {
  variants ??= new Map(
    readTable<ImageVariantTable>("image-variants").rows.map((row) => [`${row.imagePurl}@${row.tag}`, row]),
  );
  const separator = tag.indexOf("@");
  const row = variants.get(`${purl}@${separator === -1 ? tag : tag.slice(0, separator)}`);
  if (!row) return { status: "unknown" };
  const digestEvidence =
    separator === -1 ? undefined : row.digests?.find(({ digest }) => digest === tag.slice(separator + 1));
  if (separator !== -1 && !digestEvidence) return { status: "unknown" };
  return { status: "known", ...row.baseOs, source: row.source, ...(digestEvidence ? { digestEvidence } : {}) };
}

/** Look up a release codename within one family. */
export function codename(family: CodenameFamily, name: string): CodenameRow | undefined {
  return codenamesOf(family).find((row) => row.codename === name.toLowerCase());
}

/** List the codenames recorded for a release family. */
export function codenamesOf(family: CodenameFamily): readonly CodenameRow[] {
  codenames ??= readTable<{ rows: readonly CodenameRow[] }>("codenames").rows;
  return codenames.filter((row) => row.family === family);
}
