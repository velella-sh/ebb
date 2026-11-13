/**
 * Example: Proactively forecasting upcoming End-of-Life deadlines with Ebb.
 *
 * Usage:
 *   node --experimental-strip-types examples/upcoming-eol/upcoming-eol.ts [--as-of YYYY-MM-DD] [--days 180]
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, replacementFor } from "../../dist/src/index.js";

export interface StackComponent {
  name: string;
  purl: string;
  version: string;
}

export const DEFAULT_STACK: StackComponent[] = [
  { name: "Node.js Runtime", purl: "node", version: "20.0.0" },
  { name: "Node.js (Next LTS)", purl: "node", version: "22.0.0" },
  { name: "Django Web Framework", purl: "pkg:pypi/django", version: "4.2" },
  { name: "Ubuntu Base Image", purl: "pkg:docker/library/ubuntu", version: "20.04" },
  { name: "PostgreSQL Database", purl: "pkg:docker/library/postgres", version: "13" },
  { name: "Legacy Request Client", purl: "pkg:npm/request", version: "2.88.2" },
];

export interface UpcomingEolOptions {
  asOf?: string;
  horizonDays?: number;
  components?: StackComponent[];
}

export function forecastUpcomingEol(options: UpcomingEolOptions = {}) {
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const horizonDays = options.horizonDays ?? 180;
  const components = options.components ?? DEFAULT_STACK;

  const evaluated = components.map((comp) => {
    const result = check(comp.purl, comp.version, asOf);
    const match = result.matches[0];
    const repl = replacementFor(comp.purl, comp.version) ?? match?.replacement;

    return {
      ...comp,
      status: result.status,
      deadline: match?.date ?? null,
      daysLeft: match?.daysLeft ?? null,
      ruleId: match?.ruleId ?? null,
      replacement: repl ?? null,
    };
  });

  // Filter components with an upcoming deadline or already end-of-life/deprecated
  const upcoming = evaluated
    .filter((item) => {
      if (item.daysLeft !== null && item.daysLeft > 0 && item.daysLeft <= horizonDays) {
        return true;
      }
      return item.status === "scheduled";
    })
    .sort((a, b) => {
      const daysA = a.daysLeft ?? 99999;
      const daysB = b.daysLeft ?? 99999;
      return daysA - daysB;
    });

  const expired = evaluated.filter((item) => {
    if (item.status === "end-of-life" || item.status === "deprecated" || item.status === "removed") {
      return item.daysLeft === null || item.daysLeft <= 0;
    }
    return false;
  });

  return {
    asOf,
    horizonDays,
    totalScanned: evaluated.length,
    upcoming,
    expired,
    all: evaluated,
  };
}

// Execute when invoked directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const asOfArg = process.argv.find((a) => a.startsWith("--as-of="))?.slice(8) ?? "2026-01-01";
  const daysArg = Number(process.argv.find((a) => a.startsWith("--days="))?.slice(7) ?? 180);

  console.log(`Forecasting End-of-Life deadlines (Reference date: ${asOfArg}, Horizon: ${daysArg} days)\n`);

  const report = forecastUpcomingEol({ asOf: asOfArg, horizonDays: daysArg });

  console.log(`=== Approaching End-of-Life (within next ${daysArg} days) ===`);
  if (report.upcoming.length === 0) {
    console.log("No components approaching EOL within this horizon.");
  } else {
    for (const item of report.upcoming) {
      console.log(`\n⏳ ${item.name} (${item.purl}@${item.version})`);
      console.log(`   Deadline:  ${item.deadline ?? "Unknown"} (${item.daysLeft} days remaining)`);
      console.log(`   Status:    ${item.status}`);
      if (item.replacement) console.log(`   Action:    Move to ${item.replacement}`);
    }
  }

  console.log(`\n=== Already Deprecated or Expired ===`);
  if (report.expired.length === 0) {
    console.log("No expired components found.");
  } else {
    for (const item of report.expired) {
      console.log(`\n✖ ${item.name} (${item.purl}@${item.version}) -> ${item.status.toUpperCase()}`);
      if (item.replacement) console.log(`  Replacement: ${item.replacement}`);
    }
  }
}
