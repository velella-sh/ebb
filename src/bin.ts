#!/usr/bin/env node
/**
 * Small bin entry that gates on the engines.node requirement before loading the CLI.
 * Keeps stdout empty and prints a clear stderr message when Node is too old.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MIN_NODE_MAJOR = 22;

export function nodeMajor(version: string = process.version): number {
  const match = /^v(\d+)/.exec(version);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}

export function readEnginesNodeRequirement(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { engines?: { node?: string } };
    return pkg.engines?.node ?? `>=${MIN_NODE_MAJOR}`;
  } catch {
    return `>=${MIN_NODE_MAJOR}`;
  }
}

export function unsupportedNodeMessage(
  required: string = readEnginesNodeRequirement(),
  version: string = process.version,
): string {
  return `ebb requires Node.js ${required}. This process is running ${version}. Please upgrade Node.js and try again.\n`;
}

export function ensureNodeMeetsEngines(
  version: string = process.version,
): { ok: true } | { ok: false; message: string } {
  if (nodeMajor(version) < MIN_NODE_MAJOR) {
    return { ok: false, message: unsupportedNodeMessage(readEnginesNodeRequirement(), version) };
  }
  return { ok: true };
}

const isBinEntry =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] !== undefined &&
    (process.argv[1].endsWith("/bin.js") || process.argv[1].endsWith("/bin/ebb") || process.argv[1].endsWith("/ebb")));

if (isBinEntry) {
  const gate = ensureNodeMeetsEngines();
  if (!gate.ok) {
    process.stderr.write(gate.message);
    process.exit(1);
  }
  const cliUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "cli.js")).href;
  await import(cliUrl);
}
