import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";
import { buildDataBundle, serializeDataBundle } from "../../src/data-bundle.js";
import {
  ACTIVE_FILE,
  BUNDLE_FILE,
  cachedBundleDirectory,
  configureActiveData,
  SIGNATURE_FILE,
} from "../../src/data-source.js";
import { rulesFor } from "../../src/rules-for.js";
import { VERSION } from "../../src/version.js";

const roots: string[] = [];

after(async () => {
  configureActiveData({});
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

function makeNpmRule(id: string, purl: string, packageName: string, vers: string) {
  return {
    id,
    ecosystem: "npm",
    purl,
    vers,
    event: "deprecated",
    title: `${packageName} ${vers} is deprecated`,
    summary: "Synthetic test fixture rule for rulesFor ordering.",
    severity: "medium",
    sources: [{ title: "test fixture", url: `https://example.com/${id}`, accessedAt: "2099-01-15" }],
    provenance: { observedAt: "2099-01-15", reviewedAt: "2099-01-15", reviewer: "test" },
    "x-npm": { package: packageName },
  };
}

async function activateCustomNpmRules(rules: Array<Record<string, unknown>>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ebb-rules-for-order-"));
  roots.push(root);
  const packageRoot = join(root, "package");
  await cp(resolve("registry"), join(packageRoot, "registry"), { recursive: true });
  await writeFile(join(packageRoot, "package.json"), await readFile(resolve("package.json"), "utf8"));

  const npmPath = join(packageRoot, "registry", "npm.json");
  const npm = JSON.parse(await readFile(npmPath, "utf8")) as { rules: Array<Record<string, unknown>> };
  npm.rules.push(...rules);
  await writeFile(npmPath, `${JSON.stringify(npm)}\n`);

  const bundle = await buildDataBundle({
    root: packageRoot,
    createdAt: "2099-01-15T12:00:00Z",
    minimumEbbVersion: "0.0.1",
  });
  const version = bundle.manifest.version;
  const cache = join(root, "cache");
  const directory = cachedBundleDirectory(cache, version);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, BUNDLE_FILE), serializeDataBundle(bundle));
  await writeFile(join(directory, SIGNATURE_FILE), "{}");
  await writeFile(join(cache, "data", ACTIVE_FILE), `${JSON.stringify({ version })}\n`);

  configureActiveData({
    cacheDirectory: cache,
    ebbVersion: VERSION,
    verifySignature: () => ({ identity: "test@example.com", issuer: "https://example.com" }),
  });
}

test("rulesFor sorts three unordered rules oldest first using version semantics", async () => {
  const purl = "pkg:npm/ebb-order-probe";
  await activateCustomNpmRules([
    makeNpmRule("npm.package.ebb-order-probe.v10", purl, "ebb-order-probe", "vers:npm/>=10.0.0|<11.0.0"),
    makeNpmRule("npm.package.ebb-order-probe.v1", purl, "ebb-order-probe", "vers:npm/>=1.0.0|<2.0.0"),
    makeNpmRule("npm.package.ebb-order-probe.v2", purl, "ebb-order-probe", "vers:npm/>=2.0.0|<3.0.0"),
  ]);

  const ordered = rulesFor(purl);
  assert.deepEqual(
    ordered.map((rule) => rule.id),
    ["npm.package.ebb-order-probe.v1", "npm.package.ebb-order-probe.v2", "npm.package.ebb-order-probe.v10"],
  );
  configureActiveData({});
});

test("rulesFor places unbounded starts first, orders inclusive before exclusive, and breaks ties by rule id", async () => {
  const purl = "pkg:npm/ebb-order-ties";
  await activateCustomNpmRules([
    makeNpmRule("npm.package.ebb-order-ties.gt-2", purl, "ebb-order-ties", "vers:npm/>2.0.0|<3.0.0"),
    makeNpmRule("npm.package.ebb-order-ties.tie-z", purl, "ebb-order-ties", "vers:npm/>=2.0.0|<3.0.0"),
    makeNpmRule("npm.package.ebb-order-ties.tie-a", purl, "ebb-order-ties", "vers:npm/>=2.0.0|<4.0.0"),
    makeNpmRule("npm.package.ebb-order-ties.legacy", purl, "ebb-order-ties", "vers:npm/<1.0.0"),
    makeNpmRule("npm.package.ebb-order-ties.all", purl, "ebb-order-ties", "vers:npm/*"),
  ]);

  assert.deepEqual(
    rulesFor(purl).map((rule) => rule.id),
    [
      "npm.package.ebb-order-ties.all",
      "npm.package.ebb-order-ties.legacy",
      "npm.package.ebb-order-ties.tie-a",
      "npm.package.ebb-order-ties.tie-z",
      "npm.package.ebb-order-ties.gt-2",
    ],
  );
  configureActiveData({});
});

test("rulesFor returns bundled components sorted oldest first regardless of stored order", () => {
  // registry/dart.json stores rules newest-first (3.12 down to <3.0.0).
  const dart = rulesFor("pkg:generic/dart");
  assert.equal(dart[0]?.id, "dart.sdk.end-of-support-2-and-older");
  assert.equal(dart[1]?.id, "dart.sdk.end-of-support-3.0");
  assert.equal(dart[dart.length - 1]?.id, "dart.sdk.end-of-support-3.12");

  // registry/npm.json stores @angular/core newest-first (v22 down to v18-and-older).
  const angular = rulesFor("pkg:npm/@angular/core");
  assert.deepEqual(
    angular.map((rule) => rule.id),
    [
      "npm.package.angular.core.v18-and-older.end-of-support",
      "npm.package.angular.core.v19.end-of-support",
      "npm.package.angular.core.v20.scheduled-end-of-life",
      "npm.package.angular.core.v21.scheduled-end-of-life",
      "npm.package.angular.core.v22.scheduled-end-of-life",
    ],
  );
});
