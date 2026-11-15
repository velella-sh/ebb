import type { SupportedVersionsResult } from "../../pick-version.js";

/** Plain text. The word `recommended` carries the choice; colour is not used. */
export function formatVersionsText(result: SupportedVersionsResult): string {
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
  for (const note of result.notes) lines.push(note);
  return `${lines.join("\n")}\n`;
}

/** A Markdown table. The recommended line is labelled in its own column. */
export function formatVersionsMarkdown(result: SupportedVersionsResult): string {
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
  for (const note of result.notes) parts.push(`- ${note}`);
  parts.push("");
  return parts.join("\n");
}
