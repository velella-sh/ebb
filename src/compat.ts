import { readdirSync, readFileSync } from "node:fs";
import { purlIdentity } from "./purl.js";
import { parseVers, type VersRange, versContains, versionScheme } from "./vers.js";

/** One version range required by the subject. */
export interface CompatibilityRequirement {
  readonly purl: string;
  readonly vers: string;
}

export interface CompatibilitySource {
  readonly url: string;
  readonly title: string;
  readonly accessedAt: string;
}

export interface CompatibilityRow {
  readonly subject: string;
  readonly subjectVers: string;
  readonly requires: readonly CompatibilityRequirement[];
  readonly kind: "documented" | "declared";
  readonly source: CompatibilitySource;
  readonly note?: string;
}

export interface CompatibilityTable {
  readonly $schema?: string;
  readonly schemaVersion: "ebb.compat.v1";
  readonly rows: readonly CompatibilityRow[];
}

type UnknownCompatibility = { readonly status: "unknown" };

export type SupportResult =
  | UnknownCompatibility
  | { readonly status: "supported" | "not-supported"; readonly row: CompatibilityRow };

export type FirstSupportingResult =
  | UnknownCompatibility
  | { readonly status: "supported"; readonly version: string; readonly row: CompatibilityRow };

interface CompiledRow {
  row: CompatibilityRow;
  subject: VersRange;
  requirements: readonly { purl: string; range: VersRange }[];
}

/** A reader backed by an explicit set of compatibility tables. */
export interface CompatibilityReader {
  requirementsOf(purl: string, version: string): readonly CompatibilityRow[];
  supports(purl: string, version: string, runtimePurl: string, runtimeVersion: string): SupportResult;
  firstSupporting(purl: string, runtimePurl: string, runtimeVersion: string): FirstSupportingResult;
}

function matches(range: VersRange, version: string): boolean {
  if (range.all) versionScheme(range.scheme).compare(version, version);
  return versContains(range, version);
}

function canUse(row: CompatibilityRow, runtime: string, version: string): boolean {
  if (row.kind === "documented") return true;
  if (runtime === "pkg:generic/nodejs") return /^v?\d+(?:\.\d+){0,2}(?:\+[\w.-]+)?$/.test(version);
  if (runtime === "pkg:generic/python") return /^\d+(?:\.\d+){0,2}$/.test(version);
  return true;
}

function preferred(rows: readonly CompiledRow[]): readonly CompiledRow[] {
  const documented = rows.filter(({ row }) => row.kind === "documented");
  return documented.length ? documented : rows;
}

/** Creates an offline compatibility reader. Table order breaks ties at the same evidence level. */
export function createCompatibilityReader(tables: readonly CompatibilityTable[]): CompatibilityReader {
  const bySubject = new Map<string, CompiledRow[]>();
  for (const { rows } of tables) {
    for (const row of rows) {
      const entries = bySubject.get(row.subject) ?? [];
      entries.push({
        row,
        subject: parseVers(row.subjectVers),
        requirements: row.requires.map(({ purl, vers }) => ({ purl, range: parseVers(vers) })),
      });
      bySubject.set(row.subject, entries);
    }
  }

  function requirementsOf(purl: string, version: string): readonly CompatibilityRow[] {
    return (bySubject.get(purlIdentity(purl)) ?? [])
      .filter(({ subject }) => matches(subject, version))
      .map(({ row }) => row);
  }

  function supports(purl: string, version: string, runtimePurl: string, runtimeVersion: string): SupportResult {
    const runtime = purlIdentity(runtimePurl);
    const candidates = (bySubject.get(purlIdentity(purl)) ?? []).filter(
      ({ row, subject, requirements }) =>
        canUse(row, runtime, runtimeVersion) &&
        requirements.some(({ purl }) => purl === runtime) &&
        matches(subject, version),
    );
    const authoritative = preferred(candidates);
    const matching = authoritative.find(({ requirements }) =>
      requirements.filter(({ purl }) => purl === runtime).every(({ range }) => matches(range, runtimeVersion)),
    );
    if (matching) return { status: "supported", row: matching.row };
    const fallback = authoritative[0];
    return fallback ? { status: "not-supported", row: fallback.row } : { status: "unknown" };
  }

  function firstSupporting(purl: string, runtimePurl: string, runtimeVersion: string): FirstSupportingResult {
    const runtime = purlIdentity(runtimePurl);
    const entries = (bySubject.get(purlIdentity(purl)) ?? []).filter(({ row, requirements }) => {
      const ranges = requirements.filter(({ purl }) => purl === runtime);
      return (
        canUse(row, runtime, runtimeVersion) &&
        ranges.length > 0 &&
        ranges.every(({ range }) => matches(range, runtimeVersion))
      );
    });
    const scheme = entries[0]?.subject.scheme;
    if (!scheme) return { status: "unknown" };
    const compare = versionScheme(scheme);
    for (const kind of ["documented", "declared"] as const) {
      const candidates = new Set(
        entries
          .filter(({ row }) => row.kind === kind)
          .flatMap(({ subject }) =>
            subject.constraints
              .filter(({ comparator }) => comparator === "=" || comparator === ">=")
              .map(({ version }) => version),
          ),
      );
      for (const version of [...candidates].sort((left, right) => compare.compare(left, right))) {
        const answer = supports(purl, version, runtime, runtimeVersion);
        if (answer.status === "supported") return { status: answer.status, row: answer.row, version };
      }
    }
    return { status: "unknown" };
  }

  return { requirementsOf, supports, firstSupporting };
}

let bundledReader: CompatibilityReader | undefined;

function bundled(): CompatibilityReader {
  if (!bundledReader) {
    const directory = new URL("../../registry/tables/", import.meta.url);
    const tables = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".compat.json"))
      .map((entry) => entry.name)
      .sort()
      .map((name) => JSON.parse(readFileSync(new URL(name, directory), "utf8")) as CompatibilityTable);
    bundledReader = createCompatibilityReader(tables);
  }
  return bundledReader;
}

/** Lists matching rows, with both documented and declared evidence. */
export function requirementsOf(purl: string, version: string): readonly CompatibilityRow[] {
  return bundled().requirementsOf(purl, version);
}

/** Evaluates one runtime against the applicable compatibility rows. */
export function supports(purl: string, version: string, runtimePurl: string, runtimeVersion: string): SupportResult {
  return bundled().supports(purl, version, runtimePurl, runtimeVersion);
}

/** Finds the first explicitly supported release evidenced by the bundled tables. */
export function firstSupporting(purl: string, runtimePurl: string, runtimeVersion: string): FirstSupportingResult {
  return bundled().firstSupporting(purl, runtimePurl, runtimeVersion);
}
