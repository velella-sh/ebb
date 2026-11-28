import { addDays } from "../../src/forecast.js";
import { daysBetween, endBounds, median, released, type History, type ReleasedLine } from "./history.js";
import { releaseEvidence, type Estimate } from "./policies.js";

export function estimateCadence(history: History, target: ReleasedLine, cutoff: string): Estimate | undefined {
  const prior = released(history, cutoff).flatMap((line) => {
    if (line.id === target.id || line.status !== "ended" || !line.end) return [];
    const [start, finish] = endBounds(line.end);
    if (finish > cutoff || start < line.firstReleased) return [];
    return [{ line, low: daysBetween(line.firstReleased, start), high: daysBetween(line.firstReleased, finish) }];
  });
  if (prior.length < 3) return undefined;

  const point = Math.round(median(prior.map(({ low, high }) => (low + high) / 2)));
  return {
    method: "cadence",
    predictedEnd: {
      date: addDays(target.firstReleased, point),
      low: addDays(target.firstReleased, Math.min(...prior.map(({ low }) => low))),
      high: addDays(target.firstReleased, Math.max(...prior.map(({ high }) => high))),
      precision: "month",
    },
    evidence: prior.map(({ line }) => releaseEvidence(history, line)),
  };
}
