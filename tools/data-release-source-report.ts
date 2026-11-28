// Validate the selected source-freshness artifact and print one date-changed count.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

export async function dateChangedCount(path: string): Promise<number> {
  const [reportText, schemaText] = await Promise.all([
    readFile(path, "utf8"),
    readFile(new URL("../../schemas/source-report.v1.schema.json", import.meta.url), "utf8"),
  ]);
  const report: unknown = JSON.parse(reportText);
  const ajv = new Ajv2020();
  const validate = ajv.compile<{ "date-changed"?: unknown[] }>(JSON.parse(schemaText));
  if (!validate(report)) {
    throw new Error(`Invalid source report: ${ajv.errorsText(validate.errors)}.`);
  }
  if (!Array.isArray(report["date-changed"])) {
    throw new Error("Source report has no date-changed results.");
  }
  return report["date-changed"].length;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const path = process.argv[2];
  try {
    if (!path) throw new Error("Usage: data-release-source-report.js <source-report.json>");
    console.log(await dateChangedCount(path));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
