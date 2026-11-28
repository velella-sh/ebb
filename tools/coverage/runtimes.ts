/**
 * Offline checker: compare reviewed expected runtime release lines to registry rules.
 *
 *   node dist/tools/coverage/runtimes.js
 *   node dist/tools/coverage/runtimes.js --write-docs
 *
 * Exit 0 when every in-scope runtime is complete.
 * Exit 1 when coverage gaps remain (docs may still be written).
 * Exit 2 on checker or write failures.
 * Never fetches the network.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { purlIdentity } from "../../src/purl.js";
import { ruleCoversLineRange } from "../../src/rule-versions.js";

export { ruleCoversLineRange } from "../../src/rule-versions.js";
import { registryV2Issues, validateRegistryV2, type RegistryV2Rule } from "../../src/registry.js";
import { versContains } from "../../src/vers.js";

// Compiled to dist/tools/coverage/*.js — three levels up is the repository root.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXPECTED_DIR = join(ROOT, "tools/coverage/expected");
const COVERAGE_DOC = join(ROOT, "docs/coverage.md");
const TABLE_BEGIN = "<!-- runtime-coverage:begin -->";
const TABLE_END = "<!-- runtime-coverage:end -->";

/** Release-line end events only — not package/module deprecations or removals. */
const END_EVENTS = new Set(["end-of-life", "end-of-support", "scheduled-end-of-life"]);

const SCHEDULED_EVENTS = new Set(["scheduled-end-of-life"]);

export const EXIT_GAPS = 1;
export const EXIT_ERROR = 2;

export interface ExpectedSource {
  title: string;
  url: string;
  accessedAt: string;
}

export interface ExpectedEnd {
  /** Official end date; YYYY-MM-DD or YYYY-MM when the source is month-only. */
  date: string;
  precision: "day" | "month";
}

export interface ExpectedLine {
  /** Release line id as the project names it (e.g. "22", "3.11", "1.25"). */
  id: string;
  /** A concrete version that belongs to this line (documentation / sample). */
  sampleVersion: string;
  /**
   * Full release-line VERS range that one end rule must cover
   * (e.g. `vers:semver/>=18.0.0|<19.0.0`). Preferred over probe lists.
   */
  lineVers: string;
  /** First public release of the line (YYYY-MM-DD), when known. */
  firstReleased?: string;
  end?: ExpectedEnd;
  /**
   * ended — line has already ended per the official schedule.
   * supported — still supported; may require a scheduled rule when `end` is set.
   * policy — covered by a rolling support policy without a fixed calendar end.
   */
  status: "ended" | "supported" | "policy";
  /** When true, a matching scheduled-end-of-life rule is required. */
  requiresScheduled?: boolean;
}

export interface ExpectedRuntime {
  runtime: string;
  purl: string;
  registry: string;
  scheduleUrl: string;
  reviewedAt: string;
  sources: ExpectedSource[];
  /** When set, this runtime is documented as limited; empty lines is complete. */
  coverageLimit?: string;
  lines: ExpectedLine[];
}

export type LineGapKind = "missing-rule" | "missing-scheduled" | "incomplete-range" | "deadline-mismatch";

export interface LineGap {
  runtime: string;
  line: string;
  kind: LineGapKind;
  detail: string;
}

export interface RuntimeCoverage {
  runtime: string;
  complete: boolean;
  coverageLimit?: string;
  missingLines: string[];
  missingScheduled: string[];
  gaps: LineGap[];
}

export interface CoverageReport {
  runtimes: RuntimeCoverage[];
  complete: boolean;
}

function isSymbolRule(rule: RegistryV2Rule): boolean {
  return rule.usage?.some((matcher) => matcher.kind === "symbol") ?? false;
}

/**
 * Compare a registry deadline (always YYYY-MM-DD) to the official end at published precision.
 * Month precision matches on YYYY-MM; day precision requires an exact calendar day.
 */
export function deadlineMatchesOfficial(deadline: string | undefined, end: ExpectedEnd): boolean {
  if (deadline === undefined) return false;
  if (end.precision === "month") {
    return deadline.length >= 7 && deadline.slice(0, 7) === end.date;
  }
  return deadline === end.date;
}

function monthPrecisionHint(rule: RegistryV2Rule): string | undefined {
  for (const [key, value] of Object.entries(rule)) {
    if (!key.startsWith("x-") || typeof value !== "object" || value === null) continue;
    const month = (value as Record<string, unknown>).endOfLifeMonth;
    if (typeof month === "string") return month;
  }
  return undefined;
}

export function assessRuntime(expected: ExpectedRuntime, rules: readonly RegistryV2Rule[]): RuntimeCoverage {
  if (expected.coverageLimit !== undefined) {
    return {
      runtime: expected.runtime,
      complete: true,
      coverageLimit: expected.coverageLimit,
      missingLines: [],
      missingScheduled: [],
      gaps: [],
    };
  }

  const gaps: LineGap[] = [];
  const missingLines: string[] = [];
  const missingScheduled: string[] = [];

  for (const line of expected.lines) {
    const needsScheduled = line.requiresScheduled === true || (line.status === "supported" && line.end !== undefined);

    // Still-supported policy lines (no published calendar end) must not be forced into an end rule.
    // Same for supported LTS lines that only publish an "at least" floor (no fixed EOL).
    if (line.status === "policy" || (line.status === "supported" && !needsScheduled)) {
      continue;
    }

    const { lineVers } = line;
    if (!lineVers) {
      gaps.push({
        runtime: expected.runtime,
        line: line.id,
        kind: "incomplete-range",
        detail: `expected line ${line.id} is missing lineVers (full release-line range)`,
      });
      missingLines.push(line.id);
      continue;
    }

    const covering = rules.filter((rule) => ruleCoversLineRange(rule.vers, lineVers));

    if (covering.length === 0) {
      const sampleHit = rules.some((rule) => versContains(rule.vers, line.sampleVersion));
      missingLines.push(line.id);
      gaps.push({
        runtime: expected.runtime,
        line: line.id,
        kind: sampleHit ? "incomplete-range" : "missing-rule",
        detail: sampleHit
          ? `end rule(s) match sample ${expected.purl}@${line.sampleVersion} but not full lineVers ${lineVers}`
          : `no end rule covers ${expected.purl} lineVers ${lineVers}`,
      });
      continue;
    }

    if (needsScheduled) {
      // The same scheduled rule must cover the full line range AND match the official deadline.
      const scheduledOk = covering.filter(
        (rule) =>
          SCHEDULED_EVENTS.has(rule.event) &&
          line.end !== undefined &&
          deadlineMatchesOfficial(rule.deadline, line.end),
      );

      if (scheduledOk.length === 0) {
        const anyScheduled = covering.some((rule) => SCHEDULED_EVENTS.has(rule.event));
        if (!anyScheduled) {
          missingScheduled.push(line.id);
          gaps.push({
            runtime: expected.runtime,
            line: line.id,
            kind: "missing-scheduled",
            detail: `supported line ${line.id} has official end ${line.end?.date ?? "?"} but no scheduled-end-of-life rule covering ${lineVers}`,
          });
        } else {
          gaps.push({
            runtime: expected.runtime,
            line: line.id,
            kind: "deadline-mismatch",
            detail: `no scheduled rule covering ${lineVers} matches official end ${line.end?.date} (${line.end?.precision}); covering deadlines: ${covering
              .map((r) => `${r.event}:${r.deadline ?? "(none)"}`)
              .join(", ")}`,
          });
        }
      } else if (line.end?.precision === "month") {
        const withMonth = scheduledOk.filter((rule) => monthPrecisionHint(rule) === line.end!.date);
        if (withMonth.length === 0) {
          gaps.push({
            runtime: expected.runtime,
            line: line.id,
            kind: "deadline-mismatch",
            detail: `month-precision end ${line.end.date} needs x-*.endOfLifeMonth=${line.end.date} on the covering scheduled rule`,
          });
        }
      }
    } else if (line.end !== undefined) {
      // Ended lines with a scheduled covering rule still require that scheduled rule's date to match.
      const scheduled = covering.filter((rule) => SCHEDULED_EVENTS.has(rule.event));
      if (scheduled.length > 0) {
        const matched = scheduled.filter((rule) => deadlineMatchesOfficial(rule.deadline, line.end!));
        if (matched.length === 0) {
          gaps.push({
            runtime: expected.runtime,
            line: line.id,
            kind: "deadline-mismatch",
            detail: `official end ${line.end.date} (${line.end.precision}) does not match scheduled deadline(s) ${scheduled
              .map((r) => r.deadline ?? "(none)")
              .join(", ")}`,
          });
        }
      }
    }
  }

  return {
    runtime: expected.runtime,
    complete: gaps.length === 0,
    missingLines,
    missingScheduled,
    gaps,
  };
}

export async function loadExpectedRuntimes(dir = EXPECTED_DIR): Promise<ExpectedRuntime[]> {
  // Official Actions scope and inventory live in this directory and are read by tools/coverage/actions.ts.
  const names = (await readdir(dir))
    .filter((name) => name.endsWith(".json") && !name.startsWith("github-actions"))
    .sort();
  const out: ExpectedRuntime[] = [];
  for (const name of names) {
    const value = JSON.parse(await readFile(join(dir, name), "utf8")) as ExpectedRuntime;
    if (!value.runtime || !value.purl || !value.registry || !Array.isArray(value.lines)) {
      throw new Error(`${name} must be an ExpectedRuntime object`);
    }
    out.push(value);
  }
  return out;
}

export async function checkRuntimeCoverage(root = ROOT): Promise<CoverageReport> {
  const expectedDir = join(root, "tools/coverage/expected");
  const expected = await loadExpectedRuntimes(expectedDir);
  const runtimes: RuntimeCoverage[] = [];
  for (const entry of expected) {
    const rules = await loadRegistryRulesForRoot(root, entry.registry, entry.purl);
    runtimes.push(assessRuntime(entry, rules));
  }
  return { runtimes, complete: runtimes.every((r) => r.complete) };
}

export async function loadRegistryRulesForRoot(
  root: string,
  registryFile: string,
  purl: string,
): Promise<RegistryV2Rule[]> {
  const value = JSON.parse(await readFile(join(root, "registry", registryFile), "utf8")) as unknown;
  if (registryV2Issues(value).length > 0) {
    throw new Error(`registry/${registryFile} is invalid`);
  }
  const registry = validateRegistryV2(value);
  const identity = purlIdentity(purl);
  return registry.rules.filter(
    (rule) => !isSymbolRule(rule) && purlIdentity(rule.purl) === identity && END_EVENTS.has(rule.event),
  );
}

export function formatCoverageText(report: CoverageReport): string {
  const lines: string[] = ["Runtime release-line coverage", ""];
  for (const runtime of report.runtimes) {
    if (runtime.coverageLimit) {
      lines.push(`${runtime.runtime}: complete (documented limit)`);
      lines.push(`  ${runtime.coverageLimit}`);
      continue;
    }
    if (runtime.complete) {
      lines.push(`${runtime.runtime}: complete`);
      continue;
    }
    lines.push(`${runtime.runtime}: gaps`);
    if (runtime.missingLines.length > 0) {
      lines.push(`  missing lines: ${runtime.missingLines.join(", ")}`);
    }
    if (runtime.missingScheduled.length > 0) {
      lines.push(`  missing scheduled: ${runtime.missingScheduled.join(", ")}`);
    }
    for (const gap of runtime.gaps) {
      if (gap.kind === "deadline-mismatch" || gap.kind === "incomplete-range") {
        lines.push(`  ${gap.kind}: ${gap.line} — ${gap.detail}`);
      }
    }
  }
  lines.push("");
  lines.push(report.complete ? "All in-scope runtimes are complete." : "Coverage incomplete.");
  return `${lines.join("\n")}\n`;
}

export function formatCoverageTable(report: CoverageReport): string {
  const rows = ["| Runtime | Status | Missing lines | Missing scheduled |", "| --- | --- | --- | --- |"];
  for (const runtime of report.runtimes) {
    const status = runtime.coverageLimit ? "limit" : runtime.complete ? "complete" : "gaps";
    const missing = runtime.missingLines.length > 0 ? runtime.missingLines.join(", ") : "—";
    const scheduled = runtime.missingScheduled.length > 0 ? runtime.missingScheduled.join(", ") : "—";
    rows.push(`| ${runtime.runtime} | ${status} | ${missing} | ${scheduled} |`);
  }
  return `${rows.join("\n")}\n`;
}

export async function writeCoverageDoc(report: CoverageReport, path = COVERAGE_DOC): Promise<void> {
  const existing = await readFile(path, "utf8");
  const begin = existing.indexOf(TABLE_BEGIN);
  const end = existing.indexOf(TABLE_END);
  if (begin < 0 || end < 0 || end < begin) {
    throw new Error(`${path} is missing runtime-coverage markers`);
  }
  const table = `\n\n${formatCoverageTable(report)}\n`;
  const next = `${existing.slice(0, begin + TABLE_BEGIN.length)}${table}${existing.slice(end)}`;
  await writeFile(path, next);
}

/** Marker embedded in gap issues so the weekly job can dedupe while open. */
export const COVERAGE_ISSUE_MARKER = "<!-- ebb-runtime-coverage-gap -->";

export function coverageIssueTitle(runtime: string): string {
  return `runtime coverage gap: ${runtime}`;
}

/** Exact runtime marker line used to dedupe against all open coverage issues. */
export function coverageIssueMarker(runtime: string): string {
  return `${COVERAGE_ISSUE_MARKER} runtime=${runtime}`;
}

export function formatCoverageIssueBody(runtime: RuntimeCoverage): string {
  const lines = [
    coverageIssueMarker(runtime.runtime),
    "",
    `The offline runtime coverage checker found gaps for **${runtime.runtime}**.`,
    "",
    "This issue is opened by the weekly importers workflow. It does not edit `registry/`.",
    "",
  ];
  if (runtime.missingLines.length > 0) {
    lines.push("### Missing end rules", "", runtime.missingLines.map((id) => `- [ ] \`${id}\``).join("\n"), "");
  }
  if (runtime.missingScheduled.length > 0) {
    lines.push(
      "### Missing scheduled rules",
      "",
      runtime.missingScheduled.map((id) => `- [ ] \`${id}\``).join("\n"),
      "",
    );
  }
  const other = runtime.gaps.filter((g) => g.kind === "deadline-mismatch" || g.kind === "incomplete-range");
  if (other.length > 0) {
    lines.push("### Other gaps", "", ...other.map((g) => `- [ ] \`${g.line}\` (${g.kind}): ${g.detail}`), "");
  }
  lines.push(
    "### How to fix",
    "",
    "1. Read the official schedule URL on [`docs/coverage.md`](../blob/main/docs/coverage.md).",
    "2. Add or update rules in `registry/` from that source only.",
    "3. Refresh `tools/coverage/expected/` if the reviewed line list changed.",
    "4. Add cases and run `npm run lint:rules` and `node dist/tools/coverage/runtimes.js`.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv: string[]): { writeDocs: boolean } {
  return { writeDocs: argv.includes("--write-docs") };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await checkRuntimeCoverage();
  process.stdout.write(formatCoverageText(report));
  if (args.writeDocs) {
    await writeCoverageDoc(report);
    process.stdout.write(`Updated ${COVERAGE_DOC}\n`);
  }
  if (!report.complete) process.exitCode = EXIT_GAPS;
}

const isDirect = process.argv[1] !== undefined && /runtimes\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = EXIT_ERROR;
  });
}
