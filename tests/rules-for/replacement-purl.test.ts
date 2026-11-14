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
import { normalizePurl, PurlError, parsePurl } from "../../src/purl.js";
import { validateRegistryV2 } from "../../src/registry.js";
import { replacementFor } from "../../src/replacement.js";
import { versContains } from "../../src/vers/index.js";
import { VERSION } from "../../src/version.js";

const PACKAGE_ECOSYSTEM_TYPES = new Set([
  "npm",
  "pypi",
  "maven",
  "nuget",
  "golang",
  "composer",
  "cargo",
  "hex",
  "pub",
  "gem",
]);

const roots: string[] = [];

after(async () => {
  configureActiveData({});
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function activateCustomNpmRules(rules: Array<Record<string, unknown>>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ebb-repl-purl-"));
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

function sampleMatchingVersion(vers: string): string {
  const candidates = ["0.1.0", "1.0.0", "2.0.0", "2.1.0", "6.0.0", "8.0.31", "18.0.0", "19.0.0"];
  const matched = candidates.find((candidate) => {
    try {
      return versContains(vers, candidate);
    } catch {
      return false;
    }
  });
  if (matched) return matched;
  const stripped = vers.replace(/^vers:[a-z0-9_.-]+\//i, "");
  for (const part of stripped.split(/[^0-9A-Za-z.-]+/)) {
    if (/^\d/.test(part)) {
      try {
        if (versContains(vers, part)) return part;
      } catch {
        // ignore candidates that are not valid version strings for this scheme
      }
    }
  }
  throw new Error(`Unable to synthesize a matching version for "${vers}"`);
}

test("replacementFor normalises and validates package replacements across ecosystems", () => {
  assert.equal(replacementFor("pkg:npm/node-sass", "9.0.0"), "pkg:npm/sass");
  assert.equal(replacementFor("pkg:npm/babel-preset-es2015", "6.24.1"), "pkg:npm/%40babel/preset-env");
  assert.equal(replacementFor("pkg:npm/%40angular/core", "18.2.0"), "pkg:npm/%40angular/core@22");
  assert.equal(replacementFor("pkg:pypi/sklearn", "0.0"), "pkg:pypi/scikit-learn");
  assert.equal(
    replacementFor("pkg:maven/mysql/mysql-connector-java", "8.0.33"),
    "pkg:maven/com.mysql/mysql-connector-j",
  );
  assert.equal(replacementFor("pkg:nuget/Microsoft.Azure.DocumentDB", "2.22.0"), "pkg:nuget/Microsoft.Azure.Cosmos");
  assert.equal(
    replacementFor("pkg:golang/github.com/golang/protobuf", "1.5.4"),
    "pkg:golang/google.golang.org/protobuf",
  );
  assert.equal(replacementFor("pkg:composer/swiftmailer/swiftmailer", "6.3.0"), "pkg:composer/symfony/mailer");
  assert.equal(replacementFor("pkg:cargo/tempdir", "0.3.7"), "pkg:cargo/tempfile");
  assert.equal(replacementFor("pkg:hex/fennec", "0.1.0"), "pkg:hex/mongooseice");
  assert.equal(replacementFor("node-sass", "9.0.0"), "pkg:npm/sass");
});

test("every package replacement across all 25 bundled ecosystems parses as a canonical normalised PURL", () => {
  const data = getActiveDataSync();
  let tested = 0;

  for (const ecosystem of BUNDLED_ECOSYSTEMS) {
    const registry = validateRegistryV2(data.readSync(`registry/${ecosystem}.json`));
    for (const rule of registry.rules) {
      if (!rule.replacement) continue;
      const isVersionRule = rule.usage === undefined || rule.usage.some((matcher) => matcher.kind !== "symbol");
      if (!isVersionRule) continue;

      const componentType = parsePurl(rule.purl).type;
      const trimmed = rule.replacement.trim();
      if (trimmed.toLowerCase().startsWith("pkg:")) {
        const result = replacementFor(rule.purl, sampleMatchingVersion(rule.vers));
        assert.ok(result !== null);
        assert.equal(result, normalizePurl(result));
        assert.doesNotThrow(() => parsePurl(result));
        tested += 1;
        continue;
      }

      if (!PACKAGE_ECOSYSTEM_TYPES.has(componentType)) continue;
      if (
        /\s/.test(trimmed) ||
        trimmed.includes("://") ||
        trimmed.includes("(") ||
        trimmed.includes(")") ||
        trimmed.includes("prototype") ||
        trimmed.startsWith("node:") ||
        (componentType === "npm" && /[A-Z]/.test(trimmed))
      ) {
        continue;
      }

      const version = sampleMatchingVersion(rule.vers);
      const result = replacementFor(rule.purl, version);
      assert.ok(result !== null, `${rule.id} should return a replacement at ${version}`);
      assert.ok(result.startsWith("pkg:"), `${rule.id} returned non-PURL replacement ${JSON.stringify(result)}`);
      assert.equal(result, normalizePurl(result), `${rule.id} returned non-canonical PURL ${result}`);
      assert.doesNotThrow(() => parsePurl(result), `${rule.id} returned invalid PURL ${result}`);
      tested += 1;
    }
  }

  assert.equal(tested, 67, `expected all 67 version-level package replacements verified, got ${tested}`);
});

test("replacementFor preserves non-package APIs, URLs, runtime ids, and prose guidance", () => {
  assert.equal(replacementFor("pkg:npm/request", "2.88.2"), "Native fetch or a maintained HTTP client");
  assert.equal(replacementFor("pkg:npm/left-pad", "1.3.0"), "String.prototype.padStart()");
  assert.equal(replacementFor("pkg:npm/querystring", "0.2.1"), "URLSearchParams");
  assert.equal(replacementFor("pkg:npm/lodash.isequal", "4.5.0"), "node:util.isDeepStrictEqual");
  assert.equal(
    replacementFor("pkg:composer/sensiolabs/security-checker", "6.0.3"),
    "https://github.com/fabpot/local-php-security-checker",
  );
  assert.equal(replacementFor("pkg:generic/nodejs", "18.20.0"), "Node.js 22 LTS or later");
  assert.equal(replacementFor("pkg:generic/aws-lambda-runtime/nodejs22.x", "1.0.0"), "nodejs24.x");
});

test("replacementFor normalises explicit pkg: replacements and rejects invalid ones via src/purl.ts", async () => {
  await activateCustomNpmRules([
    {
      id: "npm.package.custom-valid-purl.deprecated",
      ecosystem: "npm",
      purl: "pkg:npm/custom-valid-purl",
      vers: "vers:npm/*",
      event: "deprecated",
      title: "custom-valid-purl is deprecated",
      summary: "Synthetic test fixture for explicit replacement PURL normalisation.",
      severity: "medium",
      replacement: "  pkg:NPM/@Example/NextPkg@2.0.0?Repository_Url=https://example.com#./dist  ",
      sources: [{ title: "fixture", url: "https://example.com/valid", accessedAt: "2099-01-01" }],
      provenance: { observedAt: "2099-01-01", reviewedAt: "2099-01-01", reviewer: "test" },
      "x-npm": { package: "custom-valid-purl" },
    },
    {
      id: "npm.package.custom-invalid-scheme.deprecated",
      ecosystem: "npm",
      purl: "pkg:npm/custom-invalid-scheme",
      vers: "vers:npm/*",
      event: "deprecated",
      title: "custom-invalid-scheme is deprecated",
      summary: "Synthetic test fixture for uppercase scheme rejection via src/purl.ts.",
      severity: "medium",
      replacement: "PKG:npm/sass",
      sources: [{ title: "fixture", url: "https://example.com/invalid-scheme", accessedAt: "2099-01-01" }],
      provenance: { observedAt: "2099-01-01", reviewedAt: "2099-01-01", reviewer: "test" },
      "x-npm": { package: "custom-invalid-scheme" },
    },
    {
      id: "npm.package.custom-invalid-purl.deprecated",
      ecosystem: "npm",
      purl: "pkg:npm/custom-invalid-purl",
      vers: "vers:npm/*",
      event: "deprecated",
      title: "custom-invalid-purl is deprecated",
      summary: "Synthetic test fixture for invalid explicit replacement PURL rejection.",
      severity: "medium",
      replacement: "pkg:npm/",
      sources: [{ title: "fixture", url: "https://example.com/invalid", accessedAt: "2099-01-01" }],
      provenance: { observedAt: "2099-01-01", reviewedAt: "2099-01-01", reviewer: "test" },
      "x-npm": { package: "custom-invalid-purl" },
    },
  ]);

  assert.equal(
    replacementFor("pkg:npm/custom-valid-purl", "1.0.0"),
    "pkg:npm/%40example/nextpkg@2.0.0?repository_url=https:%2F%2Fexample.com#dist",
  );
  assert.throws(() => replacementFor("pkg:npm/custom-invalid-scheme", "1.0.0"), PurlError);
  assert.throws(() => replacementFor("pkg:npm/custom-invalid-purl", "1.0.0"), PurlError);
  configureActiveData({});
});
