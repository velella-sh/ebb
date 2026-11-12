#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { check, checkAll, replacementFor, rulesFor } from "./index.js";
import { CheckError } from "./check.js";
import { checkAllWith, type CheckAllItem } from "./check-all.js";
import {
  createColors,
  formatCheckAllMarkdown,
  formatCheckAllText,
  formatCheckMarkdown,
  formatCheckText,
  formatReplacementMarkdown,
  formatReplacementText,
  formatRulesMarkdown,
  formatRulesText,
  isColorSupported,
} from "./cli/format/index.js";
import { EbbError } from "./errors.js";
import { formatPurl, parsePurl, PurlError } from "./purl.js";
import { RulesForError, type RuleEvent } from "./rules-for.js";
import { VersError } from "./vers.js";
import { VERSION } from "./version.js";

const HELP_TEXT = `ebb - The open almanac of software end-of-life

Usage:
  ebb check <purl> [version] [options]       Check lifecycle status of a package
  ebb check-all [file] [options]             Batch check packages (file, stdin, CycloneDX)
  ebb replacement <purl> [version] [options] Show suggested replacement for a package
  ebb rules <purl> [options]                 List registered lifecycle rules for a package

Options:
  --format <text|markdown|json> Output format (default: text)
  --json                        Shortcut for --format json
  --as-of <YYYY-MM-DD>          Reference date for daysLeft calculation
  --fail-on <threshold>         Fail threshold: scheduled, deprecated, unsupported, end-of-life, removed, error (default: deprecated)
  --event <name>                Filter rules by event (rules command only)
  --color                       Force colored output
  --no-color                    Disable colored output (respects NO_COLOR env)
  --no-hint                     Disable the Offing remediation hint
  -h, --help                    Show help
  -v, --version                 Show version

Examples:
  ebb check pkg:npm/request@2.88.2
  ebb check node 16.0.0 --format markdown
  ebb check-all bom.json --json
  cat purls.txt | ebb check-all --fail-on scheduled
  ebb replacement pkg:npm/request 2.88.2
  ebb rules pkg:npm/express
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
        event: { type: "string" },
        "fail-on": { type: "string" },
        color: { type: "boolean", default: false },
        "no-color": { type: "boolean", default: false },
        "no-hint": { type: "boolean", default: false },
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

  // Determine output format
  let format: "text" | "markdown" | "json" = "text";
  if (values.json) {
    format = "json";
  } else if (values.format) {
    const f = String(values.format).toLowerCase();
    if (f === "json" || f === "markdown" || f === "text") {
      format = f;
    } else {
      io.stderr.write(`Error: Invalid format "${values.format}". Expected: text, markdown, json.\n`);
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

  try {
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
      const result = check(purl, version, asOf);

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatCheckMarkdown(purl, version, result, { noHint }));
      } else {
        io.stdout.write(formatCheckText(purl, version, result, { colors, noHint }));
      }

      return shouldFail(result.status, failOn) ? 1 : 0;
    }

    if (first === "check-all") {
      const fileArg = positionals[1];
      let content = "";

      if (fileArg && fileArg !== "-") {
        try {
          content = readFileSync(resolve(process.cwd(), fileArg), "utf8");
        } catch (err) {
          io.stderr.write(`Error reading file "${fileArg}": ${err instanceof Error ? err.message : String(err)}\n`);
          return 2;
        }
      } else {
        if (process.stdin.isTTY && !fileArg) {
          io.stderr.write(
            "Error: Missing input file or piped data. Usage: ebb check-all <file> or cat <file> | ebb check-all\n",
          );
          return 2;
        }
        if (!io.stdin) {
          io.stderr.write("Error: No stdin stream available.\n");
          return 2;
        }
        content = await readStream(io.stdin);
      }

      const items = parseCheckAllInput(content);
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
      const outcome = asOf ? checkAllWith(items, (p, v) => check(p, v, asOf)) : checkAll(items);

      if (format === "json") {
        io.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatCheckAllMarkdown(items, outcome, { noHint }));
      } else {
        io.stdout.write(formatCheckAllText(items, outcome, { colors, noHint }));
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

      if (format === "json") {
        io.stdout.write(`${JSON.stringify({ purl, version, replacement: replacement ?? null }, null, 2)}\n`);
      } else if (format === "markdown") {
        io.stdout.write(formatReplacementMarkdown(purl, version, replacement));
      } else {
        io.stdout.write(formatReplacementText(purl, version, replacement));
      }

      return replacement ? 0 : 1;
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

    io.stderr.write(`Error: Unknown command "${first}". Run "ebb --help" for usage.\n`);
    return 2;
  } catch (err) {
    if (
      err instanceof EbbError ||
      err instanceof CheckError ||
      err instanceof VersError ||
      err instanceof PurlError ||
      err instanceof RulesForError
    ) {
      io.stderr.write(`Error: ${err.message}\n`);
      return 2;
    }
    const message = err instanceof Error ? err.message : String(err);
    io.stderr.write(`Error: ${message}\n`);
    return 2;
  }
}

// Run CLI when invoked directly from shell
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] &&
    (process.argv[1].endsWith("/cli.js") || process.argv[1].endsWith("/bin/ebb") || process.argv[1].endsWith("/ebb")));

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
