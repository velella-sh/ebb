/**
 * Example: which release line to take, from what Ebb actually knows.
 *
 * Usage:
 *   node --experimental-strip-types examples/pick-version/pick-version.ts
 */

import { supportedVersions } from "../../dist/src/index.js";

const asOf = "2026-11-15";
const queries = ["node", "python", "pkg:npm/request"];

for (const query of queries) {
  const result = supportedVersions(query, { asOf });
  const recommended = result.recommendation?.lineId ?? "none";
  const lines = result.lines.map((line) => line.id).join(",") || "none";
  console.log(
    `${result.purl ?? query}: complete=${result.complete} recommended=${recommended} lines=${lines}`,
  );
  console.log(`  ${result.reason}`);
}
