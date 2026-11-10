/**
 * Turns an lcov report into the JSON that shields.io's endpoint badge reads.
 *
 *   node dist/tools/coverage-badge.js coverage/lcov.info coverage/coverage.json
 *
 * The badge shows line coverage. CI runs this on main and publishes the JSON to the `badges` branch,
 * which the README badge points at, so the number follows the code without anyone editing the README.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export interface EndpointBadge {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
}

/** Line coverage as a percentage of the lines the report instruments, or undefined when it has none. */
export function lineCoverage(lcov: string): number | undefined {
  let found = 0;
  let hit = 0;
  for (const line of lcov.split(/\r?\n/)) {
    if (line.startsWith("LF:")) found += Number(line.slice(3));
    else if (line.startsWith("LH:")) hit += Number(line.slice(3));
  }
  return found > 0 ? (hit / found) * 100 : undefined;
}

function colorFor(percent: number): string {
  if (percent >= 95) return "3F6E66";
  if (percent >= 90) return "97CA00";
  if (percent >= 75) return "DFB317";
  return "E05D44";
}

export function coverageBadge(lcov: string): EndpointBadge {
  const percent = lineCoverage(lcov);
  if (percent === undefined) throw new Error("The lcov report has no instrumented lines.");
  return { schemaVersion: 1, label: "coverage", message: `${Math.floor(percent)}%`, color: colorFor(percent) };
}

export async function main(argv: string[]): Promise<number> {
  const [input, output, extra] = argv;
  if (!input || !output || extra !== undefined) throw new Error("Usage: coverage-badge <lcov.info> <badge.json>");
  const badge = coverageBadge(await readFile(input, "utf8"));
  await writeFile(output, `${JSON.stringify(badge)}\n`);
  process.stdout.write(`coverage: ${badge.message}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: Error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    },
  );
}
