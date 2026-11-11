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
import { lifecycleEvents } from "../../src/registry.js";
import { type RuleEvent, RulesForError, rulesFor } from "../../src/rules-for.js";
import { VERSION } from "../../src/version.js";

const roots: string[] = [];

after(async () => {
  configureActiveData({});
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

function makeSyntheticRule(id: string, purl: string, vers: string, event: RuleEvent) {
  return {
    id,
    ecosystem: "npm",
    purl,
    vers,
    event,
    ...(event === "scheduled-end-of-life" ? { deadline: "2099-06-01", severity: "low" } : { severity: "medium" }),
    title: `ebb-filter-probe ${event} (${vers})`,
    summary: `Synthetic ${event} rule for filter test.`,
    sources: [{ title: "test fixture", url: `https://example.com/${id}`, accessedAt: "2099-01-15" }],
    provenance: { observedAt: "2099-01-15", reviewedAt: "2099-01-15", reviewer: "test" },
    "x-npm": { package: "ebb-filter-probe" },
  };
}

async function activateCustomRules(rules: Array<Record<string, unknown>>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ebb-rules-for-filter-"));
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

test("rulesFor filters each lifecycle event on bundled components and preserves order", () => {
  const nodeAll = rulesFor("pkg:generic/nodejs");
  for (const event of ["deprecated", "end-of-life", "removed", "scheduled-end-of-life"] as const) {
    const filtered = rulesFor("pkg:generic/nodejs", { event });
    const expected = nodeAll.filter((rule) => rule.event === event);
    assert.ok(filtered.length > 0, `expected ${event} rules on nodejs`);
    assert.deepEqual(filtered, expected);
  }
  assert.deepEqual(rulesFor("pkg:generic/nodejs", { event: "end-of-support" }), []);

  const eksAll = rulesFor("pkg:generic/amazon-eks");
  const eksEos = rulesFor("pkg:generic/amazon-eks", { event: "end-of-support" });
  assert.ok(eksEos.length > 0, "expected end-of-support rules on amazon-eks");
  assert.deepEqual(
    eksEos,
    eksAll.filter((rule) => rule.event === "end-of-support"),
  );
});

test("rulesFor filters every lifecycle event on a single component cleanly", async () => {
  const purl = "pkg:npm/ebb-filter-probe";
  await activateCustomRules([
    makeSyntheticRule("npm.package.ebb-filter-probe.scheduled", purl, "vers:npm/>=5.0.0", "scheduled-end-of-life"),
    makeSyntheticRule("npm.package.ebb-filter-probe.eol", purl, "vers:npm/<1.0.0", "end-of-life"),
    makeSyntheticRule("npm.package.ebb-filter-probe.removed-v4", purl, "vers:npm/>=4.0.0|<5.0.0", "removed"),
    makeSyntheticRule("npm.package.ebb-filter-probe.deprecated", purl, "vers:npm/>=1.0.0|<2.0.0", "deprecated"),
    makeSyntheticRule("npm.package.ebb-filter-probe.eos-v2", purl, "vers:npm/>=2.0.0|<3.0.0", "end-of-support"),
    makeSyntheticRule("npm.package.ebb-filter-probe.eos-v3", purl, "vers:npm/>=3.0.0|<4.0.0", "end-of-support"),
  ]);

  assert.deepEqual(rulesFor(purl, {}), rulesFor(purl));
  assert.deepEqual(rulesFor(purl, { event: undefined }), rulesFor(purl));

  const expectedCounts: Record<RuleEvent, number> = {
    "end-of-life": 1,
    deprecated: 1,
    "end-of-support": 2,
    removed: 1,
    "scheduled-end-of-life": 1,
  };
  for (const event of lifecycleEvents) {
    const filtered = rulesFor(purl, { event });
    assert.equal(filtered.length, expectedCounts[event], `unexpected count for ${event}`);
    assert.ok(filtered.every((rule) => rule.event === event));
  }
  assert.deepEqual(
    rulesFor(purl, { event: "end-of-support" }).map((rule) => rule.id),
    ["npm.package.ebb-filter-probe.eos-v2", "npm.package.ebb-filter-probe.eos-v3"],
  );
  configureActiveData({});
});

test("rulesFor rejects unknown events with RulesForError", () => {
  for (const badEvent of ["unknown", "", "Deprecated", "unsupported", "scheduled", "ok", 123]) {
    assert.throws(
      () => rulesFor("pkg:generic/nodejs", { event: badEvent as RuleEvent }),
      (error: unknown) => error instanceof RulesForError && error.message.includes("Unknown lifecycle event"),
    );
    // Reject invalid filter values even when the target package has no rules.
    assert.throws(() => rulesFor("pkg:npm/express", { event: badEvent as RuleEvent }), RulesForError);
  }
});
