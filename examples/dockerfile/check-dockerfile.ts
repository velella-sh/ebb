/**
 * Example: Inspecting container base images in a Dockerfile with Ebb.
 *
 * Usage:
 *   node --experimental-strip-types examples/dockerfile/check-dockerfile.ts [path/to/Dockerfile]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, replacementFor } from "../../dist/src/index.js";

export interface DockerBaseImage {
  rawLine: string;
  image: string;
  tag: string;
  purl: string;
  version: string;
}

export function parseDockerfile(dockerfilePath: string): DockerBaseImage[] {
  if (!existsSync(dockerfilePath)) {
    throw new Error(`Dockerfile not found at: ${dockerfilePath}`);
  }

  const content = readFileSync(dockerfilePath, "utf-8");
  const lines = content.split("\n");
  const images: DockerBaseImage[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const fromMatch = line.match(/^FROM\s+(?:--[a-z0-9=_-]+\s+)?([^\s]+)(?:\s+AS\s+[^\s]+)?/i);
    if (!fromMatch || !fromMatch[1]) continue;

    const imageRef = fromMatch[1];
    let image = imageRef;
    let tag = "latest";

    const colonIdx = imageRef.indexOf(":");
    if (colonIdx !== -1) {
      image = imageRef.slice(0, colonIdx);
      tag = imageRef.slice(colonIdx + 1);
    }

    // Extract numerical version from tag (e.g., "16-alpine" -> "16", "3.7-slim" -> "3.7")
    const versionMatch = tag.match(/^([0-9]+(?:\.[0-9]+)?)/);
    const version = versionMatch ? versionMatch[1]! : tag;

    // Normalise to standard Docker library purl if single-segment image
    const purlNamespace = image.includes("/") ? image : `library/${image}`;
    const purl = `pkg:docker/${purlNamespace}`;

    images.push({
      rawLine: line,
      image,
      tag,
      purl,
      version,
    });
  }

  return images;
}

export function evaluateDockerfile(dockerfilePath: string) {
  const baseImages = parseDockerfile(dockerfilePath);
  const results = baseImages.map((base) => {
    const evaluation = check(base.purl, base.version);
    const repl = replacementFor(base.purl, base.version) ?? evaluation.matches[0]?.replacement;
    return {
      ...base,
      status: evaluation.status,
      rule: evaluation.matches[0]?.ruleId,
      replacement: repl,
      evaluation,
    };
  });

  return {
    dockerfilePath,
    total: baseImages.length,
    results,
    findings: results.filter((r) => r.status !== "ok"),
  };
}

// Execute when invoked directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const targetPath = resolve(process.argv[2] ?? resolve(dirname(__filename), "Dockerfile"));
  console.log(`Scanning Dockerfile at: ${targetPath}\n`);

  const report = evaluateDockerfile(targetPath);

  console.log(`Evaluated ${report.total} base image instruction(s):`);
  for (const item of report.results) {
    const symbol = item.status === "ok" ? "✓" : "✖";
    console.log(`  ${symbol} ${item.image}:${item.tag} -> ${item.status}`);
  }

  if (report.findings.length > 0) {
    console.log("\n⚠️  Identified Unsupported Base Images:");
    for (const item of report.findings) {
      console.log(`\n• FROM ${item.image}:${item.tag} (${item.purl}@${item.version}) -> ${item.status.toUpperCase()}`);
      if (item.rule) console.log(`  Rule: ${item.rule}`);
      if (item.replacement) console.log(`  Replacement: ${item.replacement}`);
    }
  } else {
    console.log("\n✅ All base images are active and supported.");
  }
}
