/**
 * Example: Querying the Ebb Static JSON API with TypeScript / modern fetch.
 *
 * Usage:
 *   node --experimental-strip-types examples/static-api/fetch-rule.ts [purl]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchComponent, purlToApiPath } from "../../dist/src/api.js";

const __filename = fileURLToPath(import.meta.url);
const localApiDir = resolve(dirname(__filename), "../../dist/site/api/v1");

// Offline-friendly fetch fallback for local testing
const customFetch: typeof fetch = async (input, init) => {
  const urlStr = String(input);
  if (urlStr.startsWith("https://velella.sh/ebb/api/v1/")) {
    const rel = urlStr.replace("https://velella.sh/ebb/api/v1/", "");
    const localFile = resolve(localApiDir, rel);
    if (existsSync(localFile)) {
      const data = readFileSync(localFile, "utf-8");
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  return globalThis.fetch(input, init);
};

export async function queryStaticApi(purl: string) {
  const relPath = purlToApiPath(purl);
  const doc = await fetchComponent(purl, { fetch: customFetch });
  return { relPath, doc };
}

// Execute when invoked directly
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const purl = process.argv[2] ?? "pkg:npm/request@2.88.2";
  console.log(`Fetching static API document for: ${purl}\n`);

  const { relPath, doc } = await queryStaticApi(purl);
  console.log(`Mapped API Path: ${relPath}`);

  if (!doc) {
    console.log("No lifecycle rules found for this component (404).");
  } else {
    console.log(`Component: ${doc.name} (type: ${doc.type})`);
    console.log(`Registered rules: ${doc.rules.length}`);
    for (const rule of doc.rules) {
      console.log(`\n• Rule: ${rule.id}`);
      console.log(`  Event:       ${rule.event}`);
      if (rule.replacement) console.log(`  Replacement: ${rule.replacement}`);
      if (rule.deadline) console.log(`  Deadline:    ${rule.deadline}`);
    }
  }
}
