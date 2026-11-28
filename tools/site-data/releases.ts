import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { type ReleaseLogEntry, verifyReleaseLog } from "../../src/data-release-log.js";
import type { RegistryV2Rule } from "../../src/registry.js";
import { verifyArtifactSignature } from "../../src/verify.js";
import type { SiteReleaseInput } from "./release.js";

export async function readSiteReleaseLog({
  bundlePath,
  version,
  sha256,
}: Pick<SiteReleaseInput, "bundlePath" | "version" | "sha256">): Promise<ReleaseLogEntry[]> {
  const directory = dirname(bundlePath);
  const [log, signature] = await Promise.all([
    readFile(join(directory, "release-log.jsonl")),
    readFile(join(directory, "release-log.jsonl.sigstore.json"), "utf8"),
  ]);
  verifyArtifactSignature(log, signature);
  const entries = verifyReleaseLog(log.toString("utf8"));
  const latest = entries.at(-1);
  if (latest?.version !== version || latest.bundleSha256 !== `sha256:${sha256}`) {
    throw new Error(`Signed release log does not match site bundle ${version}.`);
  }
  return entries;
}

export function siteReleaseRecords(log: readonly ReleaseLogEntry[], version: string, rules: readonly RegistryV2Rule[]) {
  const ecosystems = new Set(rules.map((rule) => rule.ecosystem)).size;
  return log.map((entry) => {
    const current = entry.version === version;
    return {
      id: entry.version,
      title: `Ebb lifecycle data ${entry.version}`,
      summary: current
        ? `Signed Ebb lifecycle data ${entry.version} contains ${rules.length} rules across ${ecosystems} ecosystems.`
        : `Signed Ebb lifecycle data release ${entry.version}.`,
      createdAt: entry.createdAt,
      dataVersion: entry.version,
      bundleSha256: entry.bundleSha256,
      contentDigest: entry.contentDigest,
      releaseUrl: `https://github.com/velella-sh/ebb/releases/tag/data-v${entry.version}`,
      ...(current ? { ruleCount: rules.length, ecosystemCount: ecosystems } : {}),
    };
  });
}
