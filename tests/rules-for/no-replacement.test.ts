import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";
import { BUNDLED_ECOSYSTEMS, buildDataBundle, serializeDataBundle } from "../../src/data-bundle.js";
import {
  ACTIVE_FILE,
  BUNDLE_FILE,
  cachedBundleDirectory,
  configureActiveData,
  getActiveDataSync,
  SIGNATURE_FILE,
} from "../../src/data-source.js";
import { validateRegistryV2 } from "../../src/registry.js";
import { replacementFor } from "../../src/replacement.js";
import { rulesFor } from "../../src/rules-for.js";
import { versContains } from "../../src/vers/index.js";
import { VERSION } from "../../src/version.js";

const roots: string[] = [];

after(async () => {
  configureActiveData({});
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function activateCustomNpmRule(rule: Record<string, unknown>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ebb-no-repl-"));
  roots.push(root);
  const packageRoot = join(root, "package");
  await cp(resolve("registry"), join(packageRoot, "registry"), { recursive: true });
  await writeFile(join(packageRoot, "package.json"), await readFile(resolve("package.json"), "utf8"));

  const npmPath = join(packageRoot, "registry", "npm.json");
  const npm = JSON.parse(await readFile(npmPath, "utf8")) as { rules: Array<Record<string, unknown>> };
  npm.rules.push(rule);
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

function sampleMatchingVersion(vers: string): string {
  const candidates = ["0.1.0", "1.0.0", "2.0.0", "3.0.0", "4.0.0", "5.0.0", "6.0.0", "7.0.0"];
  const matched = candidates.find((candidate) => versContains(vers, candidate));
  if (matched) return matched;
  for (const part of vers.split(/[^0-9.]+/)) {
    if (part && versContains(vers, part)) return part;
  }
  throw new Error(`Unable to synthesize a matching version for "${vers}"`);
}

test('replacementFor returns strict null (never "") and does not throw for rules with no replacement', () => {
  // Known bundled rules without a replacement field.
  assert.strictEqual(replacementFor("pkg:generic/mongodb", "5.0.0"), null);
  assert.strictEqual(replacementFor("pkg:generic/redis", "6.0.0"), null);
  assert.strictEqual(replacementFor("pkg:pub/analysis_server_client", "1.0.0"), null);
  assert.notStrictEqual(replacementFor("pkg:generic/mongodb", "5.0.0"), "");
});

test('replacementFor returns null (never "") across every version rule in bundled data lacking a replacement', () => {
  const data = getActiveDataSync();
  const checkedPurls: string[] = [];

  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const registry = validateRegistryV2(data.readSync(`registry/${ecosystem}.json`));
    for (const rule of registry.rules) {
      if (rule.replacement !== undefined) continue;
      const isVersionRule = rule.usage === undefined || rule.usage.some((matcher) => matcher.kind !== "symbol");
      if (!isVersionRule) continue;

      const siblingHasReplacement = rulesFor(rule.purl).some((sibling) => sibling.replacement !== undefined);
      if (siblingHasReplacement) continue;

      const version = sampleMatchingVersion(rule.vers);
      let result: string | null = "uninitialized";
      assert.doesNotThrow(() => {
        result = replacementFor(rule.purl, version);
      }, `${rule.id} should not throw when replacement is absent`);
      assert.strictEqual(result, null, `${rule.id} at ${version} should return null`);
      assert.notStrictEqual(result, "", `${rule.id} at ${version} must never return ""`);
      checkedPurls.push(rule.id);
    }
  }

  assert.ok(checkedPurls.length >= 30, `expected at least 30 rules without replacements, got ${checkedPurls.length}`);
});

test("replacementFor returns null without throwing for unmatched versions, unknown packages, and synthetic rules without replacement", async () => {
  assert.strictEqual(replacementFor("pkg:generic/nodejs", "24.0.0"), null);
  assert.strictEqual(replacementFor("pkg:npm/express", "4.21.0"), null);
  assert.strictEqual(replacementFor("pkg:npm/this-package-does-not-exist", "1.0.0"), null);

  await activateCustomNpmRule({
    id: "npm.package.ebb-no-repl-probe.deprecated",
    ecosystem: "npm",
    purl: "pkg:npm/ebb-no-repl-probe",
    vers: "vers:npm/*",
    event: "deprecated",
    title: "ebb-no-repl-probe is deprecated",
    summary: "Synthetic rule deliberately omitting replacement.",
    severity: "medium",
    sources: [{ title: "fixture", url: "https://example.com/no-repl", accessedAt: "2099-01-15" }],
    provenance: { observedAt: "2099-01-15", reviewedAt: "2099-01-15", reviewer: "test" },
    "x-npm": { package: "ebb-no-repl-probe" },
  });

  const result = replacementFor("pkg:npm/ebb-no-repl-probe", "1.2.3");
  assert.strictEqual(result, null);
  assert.notStrictEqual(result, "");
  configureActiveData({});
});
