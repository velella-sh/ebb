import { pathToFileURL } from "node:url";
import { addDays, addMonths } from "../../src/forecast.js";
import {
  loadExpectedRuntimes,
  type ExpectedEnd,
  type ExpectedLine,
  type ExpectedRuntime,
} from "../coverage/runtimes.js";

export type ReleasedLine = ExpectedLine & { firstReleased: string };
export type History = ExpectedRuntime;

export const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function endBounds(end: ExpectedEnd): [string, string] {
  const low = end.precision === "day" ? end.date : end.date + "-01";
  return [low, end.precision === "day" ? low : addDays(addMonths(low, 1), -1)];
}

export function released(history: History, asOf: string): ReleasedLine[] {
  return history.lines
    .filter((line): line is ReleasedLine => !!line.firstReleased && line.firstReleased <= asOf)
    .sort((a, b) => a.firstReleased.localeCompare(b.firstReleased));
}

export function formatHistory(histories: readonly History[]): string {
  const rows = [
    "| Product | Ended lines | At least three ended | Lines without announced end |",
    "| --- | --- | --- | --- |",
  ];
  for (const history of histories) {
    const ended = history.lines.filter((line) => line.status === "ended").length;
    const unresolved = history.lines.filter((line) => !line.end).map((line) => line.id);
    rows.push(
      `| ${history.runtime} | ${ended} | ${ended >= 3 ? "yes" : "no"} | ${unresolved.length}: ${unresolved.join(", ") || "none"} |`,
    );
  }
  return rows.join("\n");
}

export const loadHistory = loadExpectedRuntimes;

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.log(formatHistory(await loadHistory()));
}
