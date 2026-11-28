import type { EolPrediction } from "../../predict.js";
import type { Colors } from "./color.js";
import type { SupportedVersionsResult } from "../../pick-version.js";

function predictionLabel({ line, predictedEnd, confidence }: EolPrediction): string {
  const month = new Date(predictedEnd.date + "T00:00:00Z").toLocaleDateString("en", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  });
  return `${line} predicted ${month} (${predictedEnd.low} to ${predictedEnd.high}, ${confidence} confidence)`;
}

/** Terminal output with a label for the recommendation and optional dimmed predictions. */
export function formatVersionsText(
  result: SupportedVersionsResult,
  predicted: readonly EolPrediction[] = [],
  colors?: Colors,
): string {
  const lines: string[] = [];
  const name = result.purl ?? "unknown";
  lines.push(`${name} as of ${result.asOf}`);
  lines.push(`complete: ${result.complete ? "yes" : "no"}`);
  if (result.lines.length === 0) {
    lines.push("lines: none");
  } else {
    for (const line of result.lines) {
      const end = line.endDate ?? "no date";
      const mark = result.recommendation?.lineId === line.id ? " recommended" : "";
      lines.push(`${line.id}  ${line.status}  ${end}  ${line.ruleId}${mark}`);
    }
  }
  lines.push(result.reason);
  for (const prediction of predicted) {
    const label = predictionLabel(prediction);
    lines.push(colors?.dim(label) ?? label);
  }
  for (const note of result.notes) lines.push(note);
  return `${lines.join("\n")}\n`;
}

/** A Markdown table. The recommended line is labelled in its own column. */
export function formatVersionsMarkdown(
  result: SupportedVersionsResult,
  predicted: readonly EolPrediction[] = [],
): string {
  const name = result.purl ?? "unknown";
  const parts: string[] = [`### ${name}`, "", `As of ${result.asOf}. Complete: ${result.complete ? "yes" : "no"}.`, ""];
  if (result.lines.length === 0) {
    parts.push("No release lines.");
  } else {
    parts.push("| Line | Status | End | Rule | |");
    parts.push("| --- | --- | --- | --- | --- |");
    for (const line of result.lines) {
      const mark = result.recommendation?.lineId === line.id ? "recommended" : "";
      parts.push(`| ${line.id} | ${line.status} | ${line.endDate ?? ""} | ${line.ruleId} | ${mark} |`);
    }
  }
  parts.push("");
  parts.push(result.reason);
  for (const prediction of predicted) parts.push(`- ${predictionLabel(prediction)}`);
  for (const note of result.notes) parts.push(`- ${note}`);
  parts.push("");
  return parts.join("\n");
}
