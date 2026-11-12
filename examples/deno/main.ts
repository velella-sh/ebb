/**
 * Example demonstrating Ebb lifecycle checking in Deno.
 */

import { check, checkAll, replacementFor } from "../../dist/src/index.js";

console.log("=== Checking single component in Deno ===");
const leftPad = check("pkg:npm/left-pad", "1.3.0");
console.log(`left-pad@1.3.0 status: ${leftPad.status}`);
if (leftPad.matches.length > 0) {
  console.log(`Reason: ${leftPad.matches[0]?.reason}`);
}

console.log("\n=== Checking replacement in Deno ===");
const replacement = replacementFor("pkg:npm/node-sass", "9.0.0");
console.log(`node-sass replacement: ${replacement}`);

console.log("\n=== Batch checking 10 components in Deno ===");
const batch = checkAll([
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "pkg:npm/react", version: "18.2.0" },
  { purl: "pkg:golang/github.com/gin-gonic/gin", version: "1.9.0" },
  { purl: "pkg:pypi/requests", version: "2.28.0" },
  { purl: "pkg:cargo/rand", version: "0.8.5" },
]);

console.log(`Evaluated ${batch.summary.total} items.`);
console.log(`Status counts:`, batch.summary.byStatus);
