import { pathToFileURL } from "node:url";
import { readReleaseBaseline, readWorkingSchemas } from "./baseline.js";
import { compareCatalogs } from "./diff.js";

function main() {
  const workspace = process.cwd();
  const baseline = readReleaseBaseline(workspace);
  const changes = compareCatalogs(baseline.schemas, readWorkingSchemas(workspace));
  console.log(`Schema baseline: ${baseline.tag} (${baseline.commit})`);
  for (const change of changes) {
    console.log(`[${change.class}] ${JSON.stringify(change.file)}#${change.pointer}: ${change.message}`);
  }
  const blocking = changes.filter(({ class: kind }) => kind === "breaking" || kind === "unknown").length;
  console.log(`${changes.length} change(s), ${blocking} to resolve before strict compatibility can pass.`);
  return blocking ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new Error("Run npm run schema:evolution without arguments.");
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
