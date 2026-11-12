/**
 * Example demonstrating Ebb lifecycle checking in Bun.
 */

import { check, checkAll, replacementFor } from "../../dist/src/index.js";

console.log("=== Checking single component in Bun ===");
const leftPad = check("pkg:npm/left-pad", "1.3.0");
console.log(`left-pad@1.3.0 status: ${leftPad.status}`);

console.log("\n=== Checking replacement in Bun ===");
const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
console.log(`node-sass replacement: ${replacement}`);

console.log("\n=== Batch checking components in Bun ===");
const batch = checkAll([
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "pkg:npm/react", version: "18.2.0" },
  { purl: "pkg:golang/github.com/gin-gonic/gin", version: "1.9.0" },
  { purl: "pkg:pypi/requests", version: "2.28.0" },
]);

console.log(`Evaluated ${batch.summary.total} items in Bun.`);
console.log(`Status counts:`, batch.summary.byStatus);
