#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  asOf,
  check,
  checkAll,
  replacementFor,
  replacementsFor,
  rulesFor,
  sourcesOf,
  stale,
  supportedVersions,
  upcoming,
} from "./index.js";
import { BUNDLE_FILE, defaultCacheDirectory } from "./data-source.js";
import { dataStatus } from "./data-status.js";
import { rollback, update } from "./data-update.js";
import { diff, formatDiffMarkdown, formatDiffText } from "./diff.js";
import { verify, verifyArtifactSignature, type VerifiedSigner } from "./verify.js";
import { UpcomingError } from "./upcoming.js";
import { CheckError, type CheckResult } from "./check.js";
import type { RegistryV2Rule } from "./registry.js";
import { statusFromMatches } from "./check-core.js";
import { checkAllWith, type CheckAllItem, type CheckAllResult } from "./check-all.js";
import {
  createColors,
  formatCheckAllMarkdown,
  formatCheckAllText,
  formatCheckMarkdown,
  formatCheckText,
  formatForecastMarkdown,
  formatForecastText,
  formatRecentMarkdown,
  formatRecentText,
  formatReplacementMarkdown,
  formatReplacementText,
  formatRulesMarkdown,
  formatRulesText,
  formatSourcesMarkdown,
  formatSourcesText,
  formatStaleMarkdown,
  formatUpcomingMarkdown,
  formatUpcomingText,
  formatVersionsMarkdown,
  formatVersionsText,
  isColorSupported,
} from "./cli/format/index.js";
import { DEFAULT_FORECAST_MONTHS } from "./forecast.js";
import { EbbError } from "./errors.js";
import { formatPurl, parsePurl, PurlError } from "./purl.js";
import { RulesForError, type RuleEvent } from "./rules-for.js";
import { formatStaleText } from "./stale.js";
import { VersError } from "./vers.js";
import { VERSION } from "./version.js";

const HELP_TEXT = `ebb - The open almanac of software end-of-life

Usage:
  ebb check <purl> [version] [options]       Check lifecycle status of a package
  ebb as-of <date> <purl> [version]          Evaluate lifecycle status as of a specific date
  ebb check-all [file...] [options]          Batch check packages (file, stdin, SBOM)
  ebb replacement <purl> [version] [options] Show suggested replacement for a package
  ebb versions <purl> [options]              List release lines and recommend one
  ebb rules <purl> [options]                 List registered lifecycle rules for a package
  ebb upcoming [options]                     List upcoming end-of-life events
  ebb forecast [options]                     Forecast end-of-life events grouped by month
  ebb recent [options]                       List recent end-of-life events
  ebb stale [options]                        List rules whose review window has expired
  ebb sources <rule-id> [options]            Show evidence sources and review status for a rule
  ebb verify <file> [options]                Verify a data bundle or artifact signature
  ebb update [options]                       Update lifecycle data safely and reversibly
  ebb diff [from] [to] [options]             Compare two data releases, versions, or files
  ebb cache <path|info|clear> [options]      Inspect or clear the lifecycle data cache
  ebb data-status [options]                  Show active lifecycle data freshness and origin
  ebb release-log [options]                  List signed data releases known to the local log
  ebb mcp                                    Start the Model Context Protocol stdio server
  ebb mcp --print-config <agent>             Print MCP config snippet for an agent
  ebb mcp --self-test                        Verify MCP data load with one known check

Options:
  --format <text|markdown|json|ical> Output format (default: text)
  --json                        Shortcut for --format json
  --as-of <YYYY-MM-DD>          Reference date for time-travel lifecycle evaluation (UTC)
  --within <span|days>          Time window: 30d, 2w, 3m, 1y, or days (default: 90d)
  --fail-within <span|days>     Fail if a deadline falls within window (upcoming command)
  --months <count>              Forecast window in months (default: 12)
  --countdown                   Show live or static countdown view (upcoming command)
  --older-than <span|days>     Override review age for stale (e.g. 90d); default uses each registry
  --max-age <days>              Freshness warning threshold in days (default: 30)
  --ecosystem <name>            Filter by ecosystem (e.g. npm, python)
  --purl <purl>                 Filter by package URL
  --fail-on <threshold>         Fail threshold: scheduled, deprecated, unsupported, end-of-life, removed, error (default: deprecated)
  --min-confidence <level>      Filter by minimum confidence: tentative, likely, confirmed
  --event <name>                Filter rules by event (rules command only)
  --signature <file>            Explicit signature file path (default: <file>.sigstore.json)
  --check                       Check for data updates without downloading
  --rollback                    Roll back to previous cached data version or bundled
  --if-older-than <span|days>   Skip update check if cached data is newer than window
  --channel <stable|next>       Update channel: stable (default) or next
  --allow-downgrade             Allow updating to an older data version
  --data-version <version>      Specify a data version to download
  --since <version>             Diff active data against a specific release log version
  --fetch                       Download older release bundle when diffing with --since
  --color                       Force colored output
  --no-color                    Disable colored output (respects NO_COLOR env)
  --no-hint                     Deprecated (no-op)
  --offline                     Run in offline mode; block any network requests
  --from <file>                 Update data from a local bundle file and adjacent signature
  -q, --quiet                   Silence warnings on stderr
  -h, --help                    Show help
  -v, --version                 Show version

Examples:
  ebb check pkg:npm/request@2.88.2
  ebb check node 16.0.0 --format markdown
  ebb check-all bom.json --json
  ebb check-all bom.json sbom.spdx.json
  cat purls.txt | ebb check-all --fail-on scheduled
  ebb replacement pkg:npm/request 2.88.2
  ebb versions node --as-of 2026-11-15
  ebb rules pkg:npm/express
  ebb upcoming --within 90d --ecosystem npm
  ebb upcoming --purl pkg:npm/express --json
  ebb forecast --months 6
  ebb recent --within 30d
  ebb stale --as-of 2026-11-14
  ebb stale --older-than 90d --json
  ebb verify dist/data/bundle.json
  ebb verify bundle.json --signature bundle.json.sigstore.json
  ebb update
  ebb update --check
  ebb update --rollback
  ebb diff
  ebb diff 2026.10.01 2026.10.16
  ebb diff --format markdown
`;

export interface CliIo {
  stdout: { write(str: string): unknown };
  stderr: { write(str: string): unknown };
  stdin?: AsyncIterable<string | Buffer>;
}

export function extractPurlAndVersion(
  purlInput: string,
  explicitVersion?: string,
): { purl: string; version?: string | undefined } {
  const trimmed = purlInput.trim();
  if (explicitVersion && explicitVersion.trim()) {
    if (trimmed.toLowerCase().startsWith("pkg:")) {
      try {
        const parsed = parsePurl(trimmed);
        delete parsed.version;
        return { purl: formatPurl(parsed), version: explicitVersion.trim() };
      } catch {
        // Fall back to stripping after '@'
        const atIdx = trimmed.lastIndexOf("@");
        const clean = atIdx !== -1 ? trimmed.slice(0, atIdx) : trimmed;
        return { purl: clean, version: explicitVersion.trim() };
      }
    }
    return { purl: trimmed, version: explicitVersion.trim() };
  }

  if (trimmed.toLowerCase().startsWith("pkg:")) {
    try {
      const parsed = parsePurl(trimmed);
      if (parsed.version) {
        const ver = parsed.version;
        delete parsed.version;
        return { purl: formatPurl(parsed), version: ver };
      }
    } catch {
      const atIdx = trimmed.lastIndexOf("@");
      if (atIdx !== -1) {
        return { purl: trimmed.slice(0, atIdx), version: trimmed.slice(atIdx + 1) || undefined };
      }
    }
  }

  return { purl: trimmed, version: undefined };
}

export function parseCheckAllInput(content: string): CheckAllItem[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === "string") {
            const { purl, version } = extractPurlAndVersion(item);
            return { purl, version: version ?? "" };
          }
          if (typeof item === "object" && item !== null) {
            const obj = item as Record<string, unknown>;
            const purlStr = typeof obj.purl === "string" ? obj.purl : "";
            const verStr = typeof obj.version === "string" ? obj.version : undefined;
            const { purl, version } = extractPurlAndVersion(purlStr, verStr);
            return { purl, version: version ?? "" };
          }
          return { purl: String(item), version: "" };
        });
      }
      if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.components)) {
          return obj.components
            .filter(
              (c): c is Record<string, unknown> => typeof c === "object" && c !== null && typeof c.purl === "string",
            )
            .map((c) => {
              const purlStr = c.purl as string;
              const verStr = typeof c.version === "string" ? c.version : undefined;
              const { purl, version } = extractPurlAndVersion(purlStr, verStr);
              return { purl, version: version ?? "" };
            });
        }
        if (Array.isArray(obj.artifacts)) {
          return obj.artifacts
            .filter(
              (a): a is Record<string, unknown> => typeof a === "object" && a !== null && typeof a.purl === "string",
            )
            .map((a) => {
              const purlStr = a.purl as string;
              const verStr = typeof a.version === "string" ? a.version : undefined;
              const { purl, version } = extractPurlAndVersion(purlStr, verStr);
              return { purl, version: version ?? "" };
            });
        }
        if (Array.isArray(obj.packages)) {
          const items: CheckAllItem[] = [];
          for (const pkg of obj.packages) {
            if (typeof pkg !== "object" || pkg === null) continue;
            const pkgObj = pkg as Record<string, unknown>;
            const verStr =
              typeof pkgObj.versionInfo === "string"
                ? pkgObj.versionInfo
                : typeof pkgObj.version === "string"
                  ? pkgObj.version
                  : undefined;
            let purlStr: string | undefined = typeof pkgObj.purl === "string" ? pkgObj.purl : undefined;
            const externalRefs = (
              Array.isArray(pkgObj.externalRefs)
                ? pkgObj.externalRefs
                : Array.isArray(pkgObj.externalRef)
                  ? pkgObj.externalRef
                  : []
            ) as Array<Record<string, unknown>>;
            for (const ref of externalRefs) {
              if (typeof ref !== "object" || ref === null) continue;
              const refType = String(ref.referenceType || ref.externalRefType || "");
              const locator =
                typeof ref.referenceLocator === "string"
                  ? ref.referenceLocator
                  : typeof ref.locator === "string"
                    ? ref.locator
                    : "";
              if (refType.toLowerCase() === "purl" || locator.startsWith("pkg:")) {
                purlStr = locator;
                break;
              }
            }
            if (purlStr) {
              const { purl, version } = extractPurlAndVersion(purlStr, verStr);
              items.push({ purl, version: version ?? "" });
            }
          }
          if (items.length > 0) return items;
        }
        if (Array.isArray(obj["@graph"])) {
          const items: CheckAllItem[] = [];
          for (const elem of obj["@graph"]) {
            if (typeof elem !== "object" || elem === null) continue;
            const elemObj = elem as Record<string, unknown>;
            const elemType = String(elemObj["@type"] || elemObj.type || "");
            if (!elemType.includes("Package")) continue;
            const verStr =
              typeof elemObj.packageVersion === "string"
                ? elemObj.packageVersion
                : typeof elemObj.version === "string"
                  ? elemObj.version
                  : undefined;
            let purlStr: string | undefined;
            const externalRefs = (
              Array.isArray(elemObj.externalRef)
                ? elemObj.externalRef
                : Array.isArray(elemObj.externalRefs)
                  ? elemObj.externalRefs
                  : []
            ) as Array<Record<string, unknown>>;
            for (const ref of externalRefs) {
              if (typeof ref !== "object" || ref === null) continue;
              const locator =
                typeof ref.locator === "string"
                  ? ref.locator
                  : typeof ref.referenceLocator === "string"
                    ? ref.referenceLocator
                    : "";
              if (locator.startsWith("pkg:")) {
                purlStr = locator;
                break;
              }
            }
            if (purlStr) {
              const { purl, version } = extractPurlAndVersion(purlStr, verStr);
              items.push({ purl, version: version ?? "" });
            }
          }
          if (items.length > 0) return items;
        }
      }
    } catch {
      // Fall through to newline parsing
    }
  }

  const lines = trimmed.split("\n");
  const items: CheckAllItem[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const { purl, version } = extractPurlAndVersion(line);
    items.push({ purl, version: version ?? "" });
  }
  return items;
}

const SEVERITY_LEVELS: Record<string, number> = {
  ok: 0,
  scheduled: 1,
  deprecated: 2,
  unsupported: 3,
  "end-of-life": 4,
  removed: 5,
  error: 6,
};

export function shouldFail(status: string, threshold: string = "deprecated"): boolean {
  if (threshold === "none" || threshold === "never") {
    return false;
  }
  const statusSev = SEVERITY_LEVELS[status] ?? 6;
  const threshSev = SEVERITY_LEVELS[threshold] ?? 2;
  return statusSev >= threshSev;
}

async function readStream(stream: AsyncIterable<string | Buffer>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const CONFIDENCE_RANKS: Record<string, number> = {
  tentative: 1,
  likely: 2,
  confirmed: 3,
};

function filterResultByMinConfidence(result: CheckResult, minConfidence?: string): CheckResult {
  if (!minConfidence) return result;
  const minRank = CONFIDENCE_RANKS[minConfidence.toLowerCase()] ?? 1;
  const filteredMatches = result.matches.filter((m) => (CONFIDENCE_RANKS[m.confidence ?? "likely"] ?? 1) >= minRank);
  if (filteredMatches.length === 0) {
    return {
      ...result,
      status: "ok",
      matches: [],
    };
  }
  return {
    ...result,
    status: statusFromMatches(filteredMatches),
    matches: filteredMatches,
  };
}

function filterCheckAllByMinConfidence(outcome: CheckAllResult, minConfidence?: string): CheckAllResult {
  if (!minConfidence) return outcome;
  const byStatus: Record<string, number> = {
    ok: 0,
    deprecated: 0,
    unsupported: 0,
    "end-of-life": 0,
    removed: 0,
    scheduled: 0,
  };
  const byEvent: Record<string, number> = {
    deprecated: 0,
    unsupported: 0,
    "end-of-life": 0,
    removed: 0,
    scheduled: 0,
  };

  const results = outcome.results.map((entry) => {
    if ("status" in entry && entry.status === "error") return entry;
    const checkRes = filterResultByMinConfidence(entry as CheckResult, minConfidence);
    if (checkRes.status === "ok") {
      byStatus.ok = (byStatus.ok ?? 0) + 1;
    } else {
      byStatus[checkRes.status] = (byStatus[checkRes.status] ?? 0) + 1;
      for (const m of checkRes.matches) {
        byEvent[m.event] = (byEvent[m.event] ?? 0) + 1;
      }
    }
    return checkRes;
  });

  return {
    results,
    summary: {
      total: outcome.summary.total,
      byStatus: byStatus as CheckAllResult["summary"]["byStatus"],
      byEvent: byEvent as CheckAllResult["summary"]["byEvent"],
      errors: outcome.summary.errors,
    },
  };
}

export async function runCli(
  args: string[],
  io: CliIo = { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin },
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args,
      options: {
        json: { type: "boolean", default: false },
        format: { type: "string" },
        "as-of": { type: "string" },
        within: { type: "string" },
        "fail-within": { type: "string" },
        months: { type: "string" },
        countdown: { type: "boolean", default: false },
        "older-than": { type: "string" },
        "max-age": { type: "string" },
        ecosystem: { type: "string" },
        purl: { type: "string" },
        event: { type: "string" },
        signature: { type: "string" },
        "fail-on": { type: "string" },
        "min-confidence": { type: "string" },
        check: { type: "boolean", default: false },
        rollback: { type: "boolean", default: false },
        "if-older-than": { type: "string" },
        channel: { type: "string" },
        "allow-downgrade": { type: "boolean", default: false },
        "data-version": { type: "string" },
        since: { type: "string" },
        fetch: { type: "boolean", default: false },
        color: { type: "boolean", default: false },
        "no-color": { type: "boolean", default: false },
        "no-hint": { type: "boolean", default: false },
        offline: { type: "boolean", default: false },
        from: { type: "string" },
        quiet: { type: "boolean", short: "q", default: false },
        "print-config": { type: "string" },
        "self-test": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    io.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }

  const { values, positionals } = parsed;
  const prevOffline = process.env.EBB_OFFLINE;
  if (values.offline) {
    process.env.EBB_OFFLINE = "1";
  }

  if (values.version) {
    io.stdout.write(`ebb ${VERSION}\n`);
    return 0;
  }

  if (values.help || positionals.length === 0) {
    io.stdout.write(HELP_TEXT);
    return 0;
  }

  const first = positionals[0]!;

  if (first === "help") {
    io.stdout.write(HELP_TEXT);
    return 0;
  }

  if (first === "version") {
    io.stdout.write(`ebb ${VERSION}\n`);
    return 0;
  }

  if (first === "mcp") {
    if (typeof values["print-config"] === "string") {
      const { printMcpConfig } = await import("./cli/mcp-config.js");
      try {
        io.stdout.write(printMcpConfig(values["print-config"]));
        return 0;
      } catch (err) {
        io.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
      }
    }

    if (values["self-test"]) {
      const { runMcpSelfTest } = await import("./mcp/self-test.js");
      const result = await runMcpSelfTest();
      if (result.ok) {
        io.stdout.write(`${result.line}\n`);
        return 0;
      }
      io.stderr.write(`${result.error ?? "self-test failed"}\n`);
      return 1;
    }

    const { McpServer, listenStdio } = await import("./mcp/index.js");
    // serverInfo.version comes from the installed package.json inside McpServer.
    const server = new McpServer();
    listenStdio(server, {
      input: process.stdin,
      output: process.stdout,
      exitOnClose: true,
    });
    return 0;
  }

  // Determine output format
  let format: "text" | "markdown" | "json" | "ical" = "text";
  if (values.json) {
    format = "json";
  } else if (values.format) {
    const f = String(values.format).toLowerCase();
    if (f === "json" || f === "markdown" || f === "text" || f === "ical") {
      format = f;
    } else {
      io.stderr.write(`Error: Invalid format "${values.format}". Expected: text, markdown, json, ical.\n`);
      return 2;
    }
  }

  const enableColor = isColorSupported({
    color: Boolean(values.color),
    noColor: Boolean(values["no-color"]),
  });
  const colors = createColors(enableColor);
  const noHint = Boolean(values["no-hint"]);
  const failOn = typeof values["fail-on"] === "string" ? values["fail-on"] : "deprecated";
  const minConfidence = values["min-confidence"] as string | undefined;
  if (minConfidence !== undefined) {
    const validLevels = ["tentative", "likely", "confirmed"];
    if (!validLevels.includes(minConfidence.toLowerCase())) {
      io.stderr.write(
        `Error: Invalid min-confidence "${minConfidence}". Must be one of: tentative, likely, confirmed\n`,
      );
      return 2;
    }
  }

  let warnedStale = false;
  const emitStaleWarningIfNeeded = () => {
    if (warnedStale || values.quiet) return;
    try {
      const status = dataStatus();
      if (status.stale) {
        warnedStale = true;
        io.stderr.write(
          `Warning: Data is ${status.ageDays} days old (exceeds ${status.staleAfterDays}d freshness threshold). Run 'ebb update' to refresh.\n`,
        );
      }
    } catch {
      // Ignore
    }
  };

  try {
    if (
      [
        "check",
        "as-of",
        "check-all",
        "replacement",
        "versions",
        "rules",
        "upcoming",
        "forecast",
        "recent",
        "stale",
        "sources",
        "diff",
      ].includes(first) ||
      first.toLowerCase().startsWith("pkg:") ||
      first.includes("/")
    ) {
      emitStaleWarningIfNeeded();
    }

    if (first === "check" || first.toLowerCase().startsWith("pkg:") || first.includes("/")) {
      const isCheckSubcommand = first === "check";
      const purlArg = isCheckSubcommand ? positionals[1] : first;
      const versionArg = isCheckSubcommand ? positionals[2] : positionals[1];

      if (!purlArg) {
        io.stderr.write("Error: Missing package argument. Usage: ebb check <purl> [version]\n");
        return 2;
      }

      const { purl, version } = extractPurlAndVersion(purlArg, versionArg);
      if (!version) {
        io.stderr.write(
          `Error: Version is required for "${purlArg}". Specify it as an argument or in the PURL (e.g. "${purlArg}@1.0.0").\n`,
        );
        return 2;
      }

      const asOf = values["as-of"] as string | undefined;
      const rawResult = check(purl, version, asOf);
      const result = filterResultByMinConfidence(rawResult, minConfidence);
      const maxAgeArg = values["max-age"] ? Number.parseInt(values["max-age"] as string, 10) : undefined;
      const status = dataStatus({ now: asOf, maxAgeDays: maxAgeArg });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatCheckMarkdown(purl, version, result, { noHint, dataStatus: status }));
      } else {
        io.stdout.write(formatCheckText(purl, version, result, { colors, noHint, dataStatus: status }));
      }

      return shouldFail(result.status, failOn) ? 1 : 0;
    }

    if (first === "as-of") {
      const dateArg = positionals[1];
      const purlArg = positionals[2];
      const versionArg = positionals[3];

      if (!dateArg || !purlArg) {
        io.stderr.write("Error: Missing arguments. Usage: ebb as-of <YYYY-MM-DD> <purl> [version]\n");
        return 2;
      }

      const { purl, version } = extractPurlAndVersion(purlArg, versionArg);
      if (!version) {
        io.stderr.write(
          `Error: Version is required for "${purlArg}". Specify it as an argument or in the PURL (e.g. "${purlArg}@1.0.0").\n`,
        );
        return 2;
      }

      const client = asOf(dateArg);
      const rawResult = client.check(purl, version);
      const result = filterResultByMinConfidence(rawResult, minConfidence);
      const maxAgeArg = values["max-age"] ? Number.parseInt(values["max-age"] as string, 10) : undefined;
      const status = dataStatus({ now: dateArg, maxAgeDays: maxAgeArg });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatCheckMarkdown(purl, version, result, { noHint, dataStatus: status }));
      } else {
        io.stdout.write(formatCheckText(purl, version, result, { colors, noHint, dataStatus: status }));
      }

      return shouldFail(result.status, failOn) ? 1 : 0;
    }

    if (first === "check-all") {
      const fileArgs = positionals.slice(1);
      const items: CheckAllItem[] = [];

      if (fileArgs.length === 1 && fileArgs[0] === "-") {
        if (!io.stdin) {
          io.stderr.write("Error: No stdin stream available.\n");
          return 2;
        }
        const content = await readStream(io.stdin);
        items.push(...parseCheckAllInput(content));
      } else if (fileArgs.length > 0) {
        for (const fileArg of fileArgs) {
          try {
            const content = readFileSync(resolve(process.cwd(), fileArg), "utf8");
            items.push(...parseCheckAllInput(content));
          } catch (err) {
            io.stderr.write(`Error reading file "${fileArg}": ${err instanceof Error ? err.message : String(err)}\n`);
            return 2;
          }
        }
      } else {
        if (process.stdin.isTTY) {
          io.stderr.write(
            "Error: Missing input file or piped data. Usage: ebb check-all <file...> or cat <file> | ebb check-all\n",
          );
          return 2;
        }
        if (!io.stdin) {
          io.stderr.write("Error: No stdin stream available.\n");
          return 2;
        }
        const content = await readStream(io.stdin);
        items.push(...parseCheckAllInput(content));
      }
      if (items.length === 0) {
        if (format === "json") {
          io.stdout.write(
            JSON.stringify(
              {
                results: [],
                summary: {
                  total: 0,
                  byStatus: { ok: 0, deprecated: 0, unsupported: 0, "end-of-life": 0, removed: 0, scheduled: 0 },
                  byEvent: { deprecated: 0, unsupported: 0, "end-of-life": 0, removed: 0, scheduled: 0 },
                  errors: 0,
                },
              },
              null,
              2,
            ) + "\n",
          );
        } else if (format === "markdown") {
          io.stdout.write("No components found to check.\n");
        } else {
          io.stdout.write("No components found to check.\n");
        }
        return 0;
      }

      const asOf = values["as-of"] as string | undefined;
      const rawOutcome = asOf ? checkAllWith(items, (p, v) => check(p, v, asOf)) : checkAll(items);
      const outcome = filterCheckAllByMinConfidence(rawOutcome, minConfidence);
      const maxAgeArg = values["max-age"] ? Number.parseInt(values["max-age"] as string, 10) : undefined;
      const status = dataStatus({ now: asOf, maxAgeDays: maxAgeArg });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatCheckAllMarkdown(items, outcome, { noHint, dataStatus: status, asOf }));
      } else {
        io.stdout.write(formatCheckAllText(items, outcome, { colors, noHint, dataStatus: status, asOf }));
      }

      // Check whether any status exceeds failOn threshold
      let worstStatus = "ok";
      if (outcome.summary.errors > 0) {
        worstStatus = "error";
      } else if (outcome.summary.byStatus.removed > 0) {
        worstStatus = "removed";
      } else if (outcome.summary.byStatus["end-of-life"] > 0) {
        worstStatus = "end-of-life";
      } else if (outcome.summary.byStatus.unsupported > 0) {
        worstStatus = "unsupported";
      } else if (outcome.summary.byStatus.deprecated > 0) {
        worstStatus = "deprecated";
      } else if (outcome.summary.byStatus.scheduled > 0) {
        worstStatus = "scheduled";
      }

      return shouldFail(worstStatus, failOn) ? 1 : 0;
    }

    if (first === "replacement" || first === "replace") {
      const purlArg = positionals[1];
      const versionArg = positionals[2];

      if (!purlArg) {
        io.stderr.write("Error: Missing package argument. Usage: ebb replacement <purl> [version]\n");
        return 2;
      }

      const { purl, version } = extractPurlAndVersion(purlArg, versionArg);
      if (!version) {
        io.stderr.write(`Error: Version is required for "${purlArg}". Specify it as an argument or in the PURL.\n`);
        return 2;
      }

      const replacement = replacementFor(purl, version);
      const replacements = replacementsFor(purl, version);

      if (format === "json") {
        io.stdout.write(
          `${JSON.stringify({ purl, version, replacement: replacement ?? null, replacements }, null, 2)}\n`,
        );
      } else if (format === "markdown") {
        io.stdout.write(formatReplacementMarkdown(purl, version, replacement, replacements));
      } else {
        io.stdout.write(formatReplacementText(purl, version, replacement, replacements));
      }

      return replacement ? 0 : 1;
    }

    if (first === "versions") {
      const purlArg = positionals[1];
      if (!purlArg) {
        io.stderr.write("Error: Missing package argument. Usage: ebb versions <purl> [--as-of YYYY-MM-DD]\n");
        return 2;
      }

      const asOfArg = typeof values["as-of"] === "string" ? values["as-of"] : undefined;
      const result = supportedVersions(purlArg, asOfArg === undefined ? undefined : { asOf: asOfArg });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatVersionsMarkdown(result));
      } else {
        io.stdout.write(formatVersionsText(result));
      }

      return 0;
    }

    if (first === "rules") {
      const purlArg = positionals[1];
      if (!purlArg) {
        io.stderr.write("Error: Missing package argument. Usage: ebb rules <purl> [--event <event>]\n");
        return 2;
      }

      const eventArg = typeof values.event === "string" ? (values.event as RuleEvent) : undefined;
      const rules = rulesFor(purlArg, eventArg ? { event: eventArg } : undefined);

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(rules, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatRulesMarkdown(purlArg, rules));
      } else {
        io.stdout.write(formatRulesText(purlArg, rules));
      }

      return 0;
    }

    if (first === "upcoming") {
      const withinArg = typeof values.within === "string" ? values.within : undefined;
      const ecoArg = typeof values.ecosystem === "string" ? values.ecosystem : undefined;
      const purlArg = typeof values.purl === "string" ? values.purl : positionals[1];
      const asOfArg = typeof values["as-of"] === "string" ? values["as-of"] : undefined;

      if (format === "ical") {
        const { toICal } = await import("./export/ical.js");
        const icalText = toICal({
          within: withinArg,
          ecosystem: ecoArg,
          purl: purlArg ? [purlArg] : undefined,
          asOf: asOfArg,
        });
        io.stdout.write(icalText);
        return 0;
      }

      const result = upcoming({
        within: withinArg,
        ecosystem: ecoArg,
        purls: purlArg ? [purlArg] : undefined,
        asOf: asOfArg,
      });

      if (values.countdown) {
        const { buildCountdownRowsFromUpcoming, renderCountdownJson, runCountdown } = await import("./countdown.js");
        const asOfDate = result.asOf;
        const nowMs = Date.parse(`${asOfDate}T00:00:00Z`);
        if (format === "json") {
          const rows = buildCountdownRowsFromUpcoming(result.items, { now: nowMs });
          io.stdout.write(`${renderCountdownJson(rows, nowMs)}\n`);
        } else {
          await runCountdown({
            upcoming: result,
            now: nowMs,
            asOf: asOfDate,
            color: enableColor,
            noAnimation: !Boolean(process.stdout.isTTY),
            io: {
              isTTY: Boolean(process.stdout.isTTY),
              write: (s) => io.stdout.write(s),
              setInterval: (cb, ms) => setInterval(cb, ms),
              clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
              onInterrupt: (h) => {
                process.on("SIGINT", h);
                return () => process.off("SIGINT", h);
              },
            },
          });
        }
      } else if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatUpcomingMarkdown(result));
      } else {
        io.stdout.write(formatUpcomingText(result, { colors }));
      }

      if (typeof values["fail-within"] === "string") {
        const { parseWithinWindow } = await import("./upcoming.js");
        const parsedFail = parseWithinWindow(values["fail-within"] as string, result.asOf);
        const hasFailing = result.items.some(
          (item) => item.deadline >= result.asOf && item.deadline <= parsedFail.until,
        );
        return hasFailing ? 1 : 0;
      }

      return 0;
    }

    if (first === "forecast") {
      const asOfArg = (values["as-of"] as string | undefined) ?? new Date().toISOString().slice(0, 10);
      let monthsArg = DEFAULT_FORECAST_MONTHS;
      if (values.months) {
        const m = Number.parseInt(values.months as string, 10);
        if (!Number.isFinite(m) || m < 1) {
          io.stderr.write("Error: Invalid months argument. Expected a positive integer.\n");
          return 2;
        }
        monthsArg = m;
      }
      const ecoArg = values.ecosystem as string | undefined;
      const { BUNDLED_ECOSYSTEMS } = await import("./data/ecosystems.js");
      const { loadEcosystemSync } = await import("./data/load.js");
      const { buildForecast } = await import("./forecast.js");

      const candidateRules: RegistryV2Rule[] = [];
      if (ecoArg) {
        const ecoLower = ecoArg.toLowerCase();
        if ((BUNDLED_ECOSYSTEMS as readonly string[]).includes(ecoLower)) {
          candidateRules.push(...loadEcosystemSync(ecoLower));
        }
      } else {
        for (const eco of BUNDLED_ECOSYSTEMS) {
          candidateRules.push(...loadEcosystemSync(eco));
        }
      }

      const scan = { root: ".", findings: [] };
      const forecastResult = buildForecast(scan, candidateRules, asOfArg, monthsArg);

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(forecastResult, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatForecastMarkdown(forecastResult));
      } else {
        io.stdout.write(formatForecastText(forecastResult, { colors }));
      }

      return 0;
    }

    if (first === "recent") {
      const withinArg = typeof values.within === "string" ? values.within : undefined;
      const ecoArg = typeof values.ecosystem === "string" ? values.ecosystem : undefined;
      const purlArg = typeof values.purl === "string" ? values.purl : positionals[1];
      const asOfArg = typeof values["as-of"] === "string" ? values["as-of"] : undefined;

      const { recent } = await import("./recent.js");
      const result = recent({
        within: withinArg,
        ecosystem: ecoArg,
        purls: purlArg ? [purlArg] : undefined,
        asOf: asOfArg,
      });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatRecentMarkdown(result));
      } else {
        io.stdout.write(formatRecentText(result, { colors }));
      }

      return 0;
    }

    if (first === "stale") {
      const asOfArg = typeof values["as-of"] === "string" ? values["as-of"] : undefined;
      const olderThanArg = typeof values["older-than"] === "string" ? values["older-than"] : undefined;
      const soonWithinArg = typeof values.within === "string" ? values.within : undefined;

      const result = stale({
        asOf: asOfArg,
        olderThan: olderThanArg,
        soonWithin: soonWithinArg,
      });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatStaleMarkdown(result));
      } else {
        io.stdout.write(formatStaleText(result));
      }

      return result.counts.stale > 0 ? 1 : 0;
    }

    if (first === "sources" || first === "sources-of") {
      const ruleId = positionals[1];
      if (!ruleId) {
        io.stderr.write("Error: Missing rule id argument. Usage: ebb sources <rule-id>\n");
        return 2;
      }

      const asOfArg = typeof values["as-of"] === "string" ? values["as-of"] : undefined;
      const result = sourcesOf(ruleId, { asOf: asOfArg });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatSourcesMarkdown(result));
      } else {
        io.stdout.write(formatSourcesText(result, { colors }));
      }

      return 0;
    }

    if (first === "verify") {
      let fileArg = positionals[1];
      if (!fileArg) {
        const activeBundle = join(defaultCacheDirectory(), "current", BUNDLE_FILE);
        if (existsSync(activeBundle)) {
          fileArg = activeBundle;
        } else {
          io.stderr.write("Error: Missing file argument. Usage: ebb verify <file> [--signature <sig-file>]\n");
          return 2;
        }
      }

      const filePath = resolve(fileArg);
      const signatureArg = typeof values.signature === "string" ? values.signature : undefined;
      const sigPath = signatureArg ? resolve(signatureArg) : `${filePath}.sigstore.json`;

      let fileBytes: Buffer;
      try {
        fileBytes = readFileSync(filePath);
      } catch {
        io.stderr.write(`Error: Bundle file not found: ${filePath}\n`);
        return 2;
      }

      let signatureJson: string;
      try {
        signatureJson = readFileSync(sigPath, "utf8");
      } catch {
        io.stderr.write(`Error: Signature file not found: ${sigPath}\n`);
        return 2;
      }

      try {
        let isBundle = true;
        let verifiedBundle: ReturnType<typeof verify> | undefined;
        let verifiedSigner: VerifiedSigner;

        try {
          verifiedBundle = verify(fileBytes, signatureJson);
          verifiedSigner = verifiedBundle.signer;
        } catch (bundleErr) {
          const msg = bundleErr instanceof Error ? bundleErr.message : String(bundleErr);
          if (
            msg.includes("not valid JSON") ||
            msg.includes("must have a manifest") ||
            msg.includes("Unsupported bundle format")
          ) {
            isBundle = false;
            verifiedSigner = verifyArtifactSignature(fileBytes, signatureJson);
          } else {
            throw bundleErr;
          }
        }

        if (format === "json") {
          const out =
            isBundle && verifiedBundle
              ? {
                  ok: true,
                  file: fileArg,
                  status: "valid",
                  version: verifiedBundle.bundle.manifest.version,
                  schemaVersion: verifiedBundle.bundle.manifest.schemaVersion,
                  sequence: verifiedBundle.bundle.manifest.sequence ?? null,
                  ecosystem: verifiedBundle.bundle.manifest.ecosystem ?? null,
                  contentDigest: verifiedBundle.bundle.manifest.contentDigest,
                  files: verifiedBundle.bundle.manifest.files.length,
                  signer: {
                    identity: verifiedSigner.identity,
                    issuer: verifiedSigner.issuer,
                  },
                }
              : {
                  ok: true,
                  file: fileArg,
                  status: "valid",
                  type: "artifact",
                  signer: {
                    identity: verifiedSigner.identity,
                    issuer: verifiedSigner.issuer,
                  },
                };
          io.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
        } else {
          let text = `Verified: ${fileArg}\nStatus: valid\nSigner: ${verifiedSigner.identity}\nIssuer: ${verifiedSigner.issuer}\n`;
          if (isBundle && verifiedBundle) {
            text += `Version: ${verifiedBundle.bundle.manifest.version} (${verifiedBundle.bundle.manifest.schemaVersion})\n`;
            if (verifiedBundle.bundle.manifest.sequence) {
              text += `Sequence: ${verifiedBundle.bundle.manifest.sequence}\n`;
            }
            if (verifiedBundle.bundle.manifest.ecosystem) {
              text += `Ecosystem: ${verifiedBundle.bundle.manifest.ecosystem}\n`;
            }
            text += `Digest: ${verifiedBundle.bundle.manifest.contentDigest}\n`;
            text += `Files: ${verifiedBundle.bundle.manifest.files.length}\n`;
          }
          io.stdout.write(text);
        }
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (format === "json") {
          io.stdout.write(`${JSON.stringify({ ok: false, file: fileArg, error: msg }, null, 2)}\n`);
        } else {
          io.stderr.write(`Error: Verification failed for ${fileArg}: ${msg}\n`);
        }
        return 2;
      }
    }

    if (first === "update") {
      const rollbackFlag = Boolean(values.rollback);
      const checkFlag = Boolean(values.check);
      const allowDowngrade = Boolean(values["allow-downgrade"]);
      const channel = (values.channel as "stable" | "next" | undefined) ?? "stable";
      const targetVersion = (values["data-version"] as string | undefined) ?? positionals[1];

      try {
        if (rollbackFlag) {
          const res = await rollback();
          if (format === "json") {
            io.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
          } else {
            io.stdout.write(
              `✓ Rolled back data successfully:\n  Active: ${res.to.version} (${res.to.source})\n  Previous: ${res.from.version} (${res.from.source})\n`,
            );
          }
          return 0;
        }

        const fromPath = values.from as string | undefined;
        const signaturePath = values.signature as string | undefined;
        const ifOlderThan = values["if-older-than"] as string | undefined;

        const updateOpts: Parameters<typeof update>[0] = {
          check: checkFlag,
          allowDowngrade,
          channel,
          from: fromPath,
          signature: signaturePath,
          offline: Boolean(values.offline),
          ifOlderThan,
        };
        if (targetVersion) {
          updateOpts.version = targetVersion;
        }
        const res = await update(updateOpts);

        if (format === "json") {
          io.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
        } else {
          if (res.skipped) {
            io.stdout.write(`Skipped update check: cached data is newer than ${ifOlderThan}.\n`);
          } else if (res.status === "up-to-date") {
            const checkPrefix = ifOlderThan ? "Checked for updates: " : "";
            io.stdout.write(`${checkPrefix}Data is already up to date (${res.to.version}, ${res.to.source}).\n`);
          } else if (res.status === "update-available") {
            io.stdout.write(
              `Data update available: ${res.from.version} → ${res.to.version}.\nRun "ebb update" to download and apply.\n`,
            );
          } else if (res.status === "downloaded") {
            io.stdout.write(`✓ Downloaded data version ${res.to.version} to cache (pinned).\n`);
          } else {
            const deltaStr = res.summary
              ? ` (${res.summary.delta >= 0 ? `+${res.summary.delta}` : res.summary.delta} rules)`
              : "";
            const updatePrefix = ifOlderThan
              ? "✓ Checked and updated data successfully:"
              : "✓ Updated data successfully:";
            io.stdout.write(
              `${updatePrefix}\n  Active: ${res.to.version} (${res.to.source})${deltaStr}\n  Previous: ${res.from.version} (${res.from.source})\n  Digest: ${res.contentDigest ?? "n/a"}\n  Signer: ${res.signer?.identity ?? "n/a"}\n`,
            );
          }
        }
        return 0;
      } catch (err) {
        if (err instanceof EbbError && err.code === "offline") {
          io.stderr.write("Ebb is running in offline mode; network request stopped.\n");
          return 1;
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (format === "json") {
          io.stdout.write(`${JSON.stringify({ ok: false, error: msg }, null, 2)}\n`);
        } else {
          io.stderr.write(`Error: Update failed: ${msg}\n`);
        }
        return 1;
      }
    }

    if (first === "diff") {
      const sinceArg = values.since as string | undefined;
      const fetchFlag = Boolean(values.fetch);
      let fromArg = positionals[1];
      let toArg = positionals[2];
      if (sinceArg) {
        fromArg = sinceArg;
        toArg = toArg ?? "active";
      }
      const ecoArg = values.ecosystem as string | undefined;

      try {
        const res = await diff(fromArg, toArg, { ecosystem: ecoArg, since: sinceArg, fetch: fetchFlag });
        if (format === "json") {
          io.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
        } else if (format === "markdown") {
          io.stdout.write(formatDiffMarkdown(res));
        } else {
          io.stdout.write(`${formatDiffText(res, { color: enableColor })}\n`);
        }
        return 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (format === "json") {
          io.stdout.write(`${JSON.stringify({ ok: false, error: msg }, null, 2)}\n`);
        } else {
          io.stderr.write(`Error: Diff failed: ${msg}\n`);
        }
        return 2;
      }
    }

    if (first === "data-status" || first === "status" || first === "freshness") {
      const nowArg = values["as-of"] as string | undefined;
      const maxAgeArg = values["max-age"] ? Number.parseInt(values["max-age"] as string, 10) : undefined;
      const status = dataStatus({ now: nowArg, maxAgeDays: maxAgeArg });

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
        return status.stale ? 1 : 0;
      }

      if (format === "markdown") {
        const rollbackText = status.hasRollback
          ? status.rollbackVersion
            ? `Yes (\`${status.rollbackVersion}\`)`
            : "Yes"
          : "No";
        const mdLines: string[] = [
          "### Ebb Lifecycle Data Status\n",
          `- **Source:** \`${status.source}\` (\`${status.version}\`)`,
          `- **Origin:** \`${status.origin ?? (status.source === "bundled" ? "package" : "cache")}\``,
          `- **Cache Path:** \`${status.cachePath ?? status.cacheDirectory}\``,
          `- **Rollback Available:** ${rollbackText}`,
          `- **Reviewed Through:** \`${status.reviewedThrough}\``,
          `- **Age:** ${status.ageDays} days`,
          `- **Stale Threshold:** ${status.staleAfterDays} days`,
          `- **Status:** ${status.stale ? "❌ Stale" : "✅ Fresh"}`,
        ];
        if (status.warnings.length > 0) {
          mdLines.push("\n**Warnings:**");
          for (const w of status.warnings) {
            mdLines.push(`- ⚠️ ${w}`);
          }
        }
        io.stdout.write(`${mdLines.join("\n")}\n`);
        return status.stale ? 1 : 0;
      }

      const rollbackDesc = status.hasRollback
        ? status.rollbackVersion
          ? `yes (${status.rollbackVersion})`
          : "yes"
        : "no";
      const lines: string[] = [
        `Lifecycle data status:`,
        `  Source:           ${status.source} (${status.version})`,
        `  Origin:           ${status.origin ?? (status.source === "bundled" ? "package" : "cache")}`,
        `  Cache path:       ${status.cachePath ?? status.cacheDirectory}`,
        `  Rollback copy:    ${rollbackDesc}`,
        `  Reviewed through: ${status.reviewedThrough}`,
        `  Data age:         ${status.ageDays} days`,
        `  Freshness limit:  ${status.staleAfterDays} days`,
        `  Status:           ${status.stale ? colors.yellow("stale") : colors.green("fresh")}`,
      ];
      if (status.warnings.length > 0) {
        lines.push(`  Warnings:`);
        for (const w of status.warnings) {
          lines.push(`    - ${colors.yellow(w)}`);
        }
      }
      io.stdout.write(`${lines.join("\n")}\n`);
      return status.stale ? 1 : 0;
    }

    if (first === "cache") {
      const { runCache } = await import("./cli/cache.js");
      const sub = positionals[1];
      return runCache({ subcommand: sub, format }, io);
    }

    if (first === "release-log") {
      const { runReleaseLog } = await import("./cli/release-log.js");
      return runReleaseLog({ format }, io);
    }

    io.stderr.write(`Error: Unknown command "${first}". Run "ebb --help" for usage.\n`);
    return 2;
  } catch (err) {
    if (
      err instanceof EbbError ||
      err instanceof CheckError ||
      err instanceof VersError ||
      err instanceof PurlError ||
      err instanceof RulesForError ||
      err instanceof UpcomingError
    ) {
      io.stderr.write(`Error: ${err.message}\n`);
      return 2;
    }
    const message = err instanceof Error ? err.message : String(err);
    io.stderr.write(`Error: ${message}\n`);
    return 2;
  } finally {
    if (values.offline) {
      if (prevOffline === undefined) delete process.env.EBB_OFFLINE;
      else process.env.EBB_OFFLINE = prevOffline;
    }
  }
}

// Run CLI when invoked directly from shell
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] &&
    (process.argv[1].endsWith("/cli.js") ||
      process.argv[1].endsWith("/bin.js") ||
      process.argv[1].endsWith("/bin/ebb") ||
      process.argv[1].endsWith("/ebb")));

if (isMain) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
    });
}
