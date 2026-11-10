import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { check, resolveCandidateRules } from "../../src/check.js";
import { buildDataBundle, serializeDataBundle } from "../../src/data-bundle.js";
import {
  ACTIVE_FILE,
  BUNDLE_FILE,
  cachedBundleDirectory,
  configureActiveData,
  SIGNATURE_FILE,
} from "../../src/data-source.js";
import { VERSION } from "../../src/version.js";

const roots: string[] = [];
const probeId = "npm.package.ebb-check-active-data-probe.deprecated";
const probePurl = "pkg:npm/ebb-check-active-data-probe";

after(async () => {
  configureActiveData({});
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

/** A throwaway package root with registries plus one rule that is not in the shipped bundle. */
async function registryWithProbe(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ebb-check-active-"));
  roots.push(root);
  const packageRoot = join(root, "package");
  await cp(resolve("registry"), join(packageRoot, "registry"), { recursive: true });
  await writeFile(join(packageRoot, "package.json"), await readFile(resolve("package.json"), "utf8"));

  const npmPath = join(packageRoot, "registry", "npm.json");
  const npm = JSON.parse(await readFile(npmPath, "utf8")) as { rules: Array<Record<string, unknown>> };
  npm.rules.push({
    id: probeId,
    ecosystem: "npm",
    purl: probePurl,
    vers: "vers:npm/*",
    event: "deprecated",
    title: "ebb-check-active-data-probe is deprecated",
    summary: "Synthetic rule that exists only in the downloaded active data for this test.",
    severity: "medium",
    replacement: "nothing",
    sources: [
      {
        title: "test fixture",
        url: "https://example.com/ebb-check-active-data-probe",
        accessedAt: "2099-01-15",
      },
    ],
    provenance: { observedAt: "2099-01-15", reviewedAt: "2099-01-15", reviewer: "test" },
    "x-npm": { package: "ebb-check-active-data-probe" },
  });
  await writeFile(npmPath, `${JSON.stringify(npm)}\n`);
  return packageRoot;
}

/** Stages a verified-looking cache whose active pointer names the probe bundle. */
async function stageActiveCache(packageRoot: string): Promise<{ cache: string; version: string }> {
  // Far newer than bundled reviewedThrough so the cache wins over the package copy.
  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2099-01-15T12:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const version = bundle.manifest.version;
  const cache = join(packageRoot, "..", "cache");
  const directory = cachedBundleDirectory(cache, version);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, BUNDLE_FILE), serializeDataBundle(bundle));
  await writeFile(join(directory, SIGNATURE_FILE), "{}");
  await writeFile(join(cache, "data", ACTIVE_FILE), `${JSON.stringify({ version })}\n`);
  return { cache, version };
}

test("check sees a rule that exists only in downloaded active data", async () => {
  const packageRoot = await registryWithProbe();
  const { cache } = await stageActiveCache(packageRoot);

  configureActiveData({
    cacheDirectory: cache,
    ebbVersion: VERSION,
    verifySignature: () => ({ identity: "test@example.com", issuer: "https://example.com" }),
  });

  const candidates = resolveCandidateRules(probePurl);
  assert.equal(
    candidates.some((rule) => rule.id === probeId),
    true,
  );

  const result = check(probePurl, "1.0.0");
  assert.equal(result.status, "deprecated");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0]?.ruleId, probeId);

  configureActiveData({});
  assert.deepEqual(resolveCandidateRules(probePurl), []);
  assert.equal(check(probePurl, "1.0.0").status, "ok");
});
