#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { check, CheckError } from "./check.js";
import { checkAll, checkAllWith, type CheckAllItem } from "./check-all.js";
import { EbbError } from "./errors.js";
import { formatPurl, parsePurl, PurlError } from "./purl.js";
import { replacementFor } from "./replacement.js";
import { rulesFor, RulesForError, type RuleEvent } from "./rules-for.js";
import { VersError } from "./vers.js";
import { VERSION } from "./version.js";

const HELP_TEXT = `ebb - The open almanac of software end-of-life

Usage:
  ebb check <purl> [version] [options]       Check lifecycle status of a package
  ebb check-all [file] [options]             Batch check packages (file, stdin, CycloneDX)
  ebb replacement <purl> [version] [options] Show suggested replacement for a package
  ebb rules <purl> [options]                 List registered lifecycle rules for a package

Options:
  --json                 Output result in JSON format
  --as-of <YYYY-MM-DD>   Reference date for daysLeft calculation
  --event <name>         Filter rules by event (rules command only)
  -h, --help             Show help
  -v, --version          Show version

Examples:
  ebb check pkg:npm/request@2.88.2
  ebb check node 16.0.0 --json
  ebb check-all bom.json --json
  cat purls.txt | ebb check-all
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
        "as-of": { type: "string" },
        event: { type: "string" },
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

      if (values.json) {
        io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        if (result.status === "ok") {
          io.stdout.write(`✓ ${purl}@${version} is ok\n`);
        } else {
          io.stdout.write(`✖ ${purl}@${version}: ${result.status}\n`);
          for (const match of result.matches) {
            io.stdout.write(`  Rule: ${match.ruleId}\n`);
            const dateStr = match.date ? ` (${match.date})` : "";
            const daysStr = match.daysLeft !== null ? ` [${match.daysLeft} days left]` : "";
            io.stdout.write(`  Event: ${match.event}${dateStr}${daysStr}\n`);
            if (match.replacement) {
              io.stdout.write(`  Replacement: ${match.replacement}\n`);
            }
            if (match.sources && match.sources.length > 0) {
              io.stdout.write("  Sources:\n");
              for (const s of match.sources) {
                io.stdout.write(`    - ${s.url}\n`);
              }
            }
          }
        }
      }

      return result.status === "ok" ? 0 : 1;
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
        if (values.json) {
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
        } else {
          io.stdout.write("No components found to check.\n");
        }
        return 0;
      }

      const asOf = values["as-of"] as string | undefined;
      const outcome = asOf ? checkAllWith(items, (p, v) => check(p, v, asOf)) : checkAll(items);

      if (values.json) {
        io.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
      } else {
        for (let i = 0; i < outcome.results.length; i++) {
          const res = outcome.results[i]!;
          if ("status" in res && res.status === "error") {
            io.stdout.write(`✖ [${res.index}] ${res.message}\n`);
          } else if ("status" in res) {
            const item = items[i];
            const label = item ? `${item.purl}@${item.version}` : `item ${i}`;
            if (res.status === "ok") {
              io.stdout.write(`✓ ${label}: ok\n`);
            } else {
              const ruleIds = res.matches.map((m) => m.ruleId).join(", ");
              io.stdout.write(`✖ ${label}: ${res.status}${ruleIds ? ` (${ruleIds})` : ""}\n`);
            }
          }
        }

        io.stdout.write(`\nSummary (${outcome.summary.total} total):\n`);
        io.stdout.write(`  ok:          ${outcome.summary.byStatus.ok}\n`);
        if (outcome.summary.byStatus.deprecated > 0) {
          io.stdout.write(`  deprecated:  ${outcome.summary.byStatus.deprecated}\n`);
        }
        if (outcome.summary.byStatus.unsupported > 0) {
          io.stdout.write(`  unsupported: ${outcome.summary.byStatus.unsupported}\n`);
        }
        if (outcome.summary.byStatus["end-of-life"] > 0) {
          io.stdout.write(`  end-of-life: ${outcome.summary.byStatus["end-of-life"]}\n`);
        }
        if (outcome.summary.byStatus.removed > 0) {
          io.stdout.write(`  removed:     ${outcome.summary.byStatus.removed}\n`);
        }
        if (outcome.summary.byStatus.scheduled > 0) {
          io.stdout.write(`  scheduled:   ${outcome.summary.byStatus.scheduled}\n`);
        }
        if (outcome.summary.errors > 0) {
          io.stdout.write(`  errors:      ${outcome.summary.errors}\n`);
        }
      }

      const hasIssues =
        outcome.summary.errors > 0 ||
        outcome.summary.byStatus.deprecated > 0 ||
        outcome.summary.byStatus.unsupported > 0 ||
        outcome.summary.byStatus["end-of-life"] > 0 ||
        outcome.summary.byStatus.removed > 0 ||
        outcome.summary.byStatus.scheduled > 0;

      return hasIssues ? 1 : 0;
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

      if (values.json) {
        io.stdout.write(`${JSON.stringify({ purl, version, replacement: replacement ?? null }, null, 2)}\n`);
      } else {
        if (replacement) {
          io.stdout.write(`${replacement}\n`);
        } else {
          io.stdout.write(`No suggested replacement for ${purl}@${version}\n`);
        }
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

      if (values.json) {
        io.stdout.write(`${JSON.stringify(rules, null, 2)}\n`);
      } else {
        if (rules.length === 0) {
          io.stdout.write(`No rules found for ${purlArg}\n`);
        } else {
          io.stdout.write(`Found ${rules.length} rule${rules.length === 1 ? "" : "s"} for ${purlArg}:\n`);
          for (const rule of rules) {
            const deadline = rule.deadline ? ` (deadline: ${rule.deadline})` : "";
            io.stdout.write(`- ${rule.id} [${rule.event}] vers: "${rule.vers}"${deadline}\n`);
            if (rule.replacement) {
              io.stdout.write(`    Replacement: ${rule.replacement}\n`);
            }
          }
        }
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
