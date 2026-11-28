import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isIsoDate } from "../../src/registry.js";
import { addDays } from "../../src/upcoming.js";
import { compareText } from "../successors-audit.js";

export interface CoverageWeek {
  week: string;
  asOf: string;
  dataVersion: string;
  rules: number;
  components: number;
  gaps: number;
  requestsAvailable: boolean;
}

export function weekOf(asOf: string): string {
  if (!isIsoDate(asOf)) throw new Error("Coverage requires a valid YYYY-MM-DD UTC reference date.");
  return addDays(asOf, -((new Date(asOf).getUTCDay() + 6) % 7));
}

export async function loadWeeks(directories: readonly string[]): Promise<CoverageWeek[]> {
  const weeks = new Map<string, CoverageWeek>();
  for (const directory of directories) {
    const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const name of files.filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/u.test(file)).sort()) {
      const value = JSON.parse(await readFile(join(directory, name), "utf8")) as CoverageWeek;
      if (
        `${value.week}.json` !== name ||
        weekOf(value.asOf) !== value.week ||
        !/^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/u.test(value.dataVersion) ||
        typeof value.requestsAvailable !== "boolean" ||
        [value.rules, value.components, value.gaps].some((count) => !Number.isSafeInteger(count) || count < 0)
      ) {
        throw new Error(`Invalid coverage history file ${name}.`);
      }
      const existing = weeks.get(value.week);
      if (existing && JSON.stringify(existing) !== JSON.stringify(value))
        throw new Error(`Conflicting archive for week ${value.week}.`);
      weeks.set(value.week, value);
    }
  }
  return [...weeks.values()].sort((a, b) => compareText(a.week, b.week));
}

export async function archiveWeeks(
  directory: string,
  weeks: readonly CoverageWeek[],
  current: CoverageWeek,
): Promise<CoverageWeek[]> {
  await mkdir(directory, { recursive: true });
  const entries = [...weeks];
  if (!entries.some(({ week }) => week === current.week)) entries.push(current);
  for (const entry of entries) {
    const path = join(directory, `${entry.week}.json`);
    const content = JSON.stringify(entry, null, 2) + "\n";
    try {
      await writeFile(path, content, { flag: "wx" });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || (await readFile(path, "utf8")) !== content) throw error;
    }
  }
  return entries.sort((a, b) => compareText(a.week, b.week));
}
