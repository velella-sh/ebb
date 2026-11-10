import assert from "node:assert/strict";
import { appendFile, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { formatPurl, normalizePurl, parsePurl, type PackageUrl } from "../../src/purl.js";

// Compiled under dist/tests/purl/; reach the source tree the same way vers tests do.
const fixturesRoot = fileURLToPath(new URL("../../../tests/purl/fixtures", import.meta.url));

type TestType = "parse" | "build" | "validate";
type TestGroup = "required" | "recommended";

interface PurlComponents {
  type: string | null;
  namespace: string | null;
  name: string | null;
  version: string | null;
  qualifiers: Record<string, string> | null;
  subpath: string | null;
}

interface FixtureCase {
  description: string;
  test_group: TestGroup;
  test_type: TestType;
  input: string | PurlComponents;
  expected_output: string | PurlComponents | null;
  expected_failure: boolean;
}

interface FixtureFile {
  tests: FixtureCase[];
}

async function* walkJson(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkJson(path);
    else if (entry.name.endsWith(".json")) yield path;
  }
}

function caseName(suiteRel: string, index: number, testType: TestType): string {
  return `${suiteRel}[${index}]:${testType}`;
}

function componentsToPurl(input: PurlComponents): PackageUrl {
  return {
    type: input.type ?? "",
    ...(input.namespace != null ? { namespace: input.namespace } : {}),
    name: input.name ?? "",
    ...(input.version != null ? { version: input.version } : {}),
    ...(input.qualifiers != null ? { qualifiers: input.qualifiers } : {}),
    ...(input.subpath != null ? { subpath: input.subpath } : {}),
  };
}

function parsedShape(parsed: PackageUrl): PurlComponents {
  return {
    type: parsed.type,
    namespace: parsed.namespace ?? null,
    name: parsed.name,
    version: parsed.version ?? null,
    qualifiers: parsed.qualifiers ?? null,
    subpath: parsed.subpath ?? null,
  };
}

/**
 * Qualifiers are a map. Some vendored fixtures list the same pairs in input order and
 * others list them sorted, so a JSON text compare treats key order as a failure.
 */
function comparableComponents(components: PurlComponents): PurlComponents {
  const qualifiers = components.qualifiers;
  if (qualifiers == null) return components;
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(qualifiers).sort((left, right) => left.localeCompare(right))) {
    const value = qualifiers[key];
    if (value !== undefined) sorted[key] = value;
  }
  return { ...components, qualifiers: sorted };
}

/**
 * Required cases use strict parse (ECMA-427 "shall").
 * Recommended cases apply remediation via normalizePurl first (ECMA-427 "should").
 */
function runCase(tc: FixtureCase): boolean {
  if (tc.test_type === "parse") {
    assert.equal(typeof tc.input, "string");
    let parsed: PackageUrl;
    try {
      const input = tc.input as string;
      parsed = tc.test_group === "recommended" ? parsePurl(normalizePurl(input)) : parsePurl(input);
    } catch {
      return tc.expected_failure;
    }
    if (tc.expected_failure) return false;
    return (
      JSON.stringify(comparableComponents(parsedShape(parsed))) ===
      JSON.stringify(comparableComponents(tc.expected_output as PurlComponents))
    );
  }

  if (tc.test_type === "build") {
    assert.equal(typeof tc.input, "object");
    let built: string;
    try {
      built = formatPurl(componentsToPurl(tc.input as PurlComponents));
    } catch {
      return tc.expected_failure;
    }
    if (tc.expected_failure) return false;
    return built === tc.expected_output;
  }

  if (tc.test_type === "validate") {
    assert.equal(typeof tc.input, "string");
    let canonical: string;
    try {
      canonical = normalizePurl(tc.input as string);
    } catch {
      return tc.expected_failure;
    }
    if (tc.expected_failure) return false;
    return canonical === tc.expected_output;
  }

  return false;
}

test("official purl-spec suite", async () => {
  const seen = new Set<string>();
  const failures: string[] = [];
  let total = 0;
  let passed = 0;

  for await (const path of walkJson(fixturesRoot)) {
    const suite = JSON.parse(await readFile(path, "utf8")) as FixtureFile;
    const suiteRel = relative(fixturesRoot, path).replaceAll("\\", "/");
    for (const [index, tc] of suite.tests.entries()) {
      const name = caseName(suiteRel, index, tc.test_type);
      assert.ok(!seen.has(name), `duplicate case name: ${name}`);
      seen.add(name);
      total += 1;
      if (runCase(tc)) {
        passed += 1;
      } else {
        failures.push(name);
      }
    }
  }

  const rateLine = `purl-spec pass rate: ${passed}/${total}`;
  assert.match(rateLine, /^purl-spec pass rate: \d+\/\d+$/);
  console.log(rateLine);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await appendFile(summaryPath, `## ${rateLine}\n\n`, "utf8");
  }

  assert.deepEqual(failures, [], `purl-spec cases failed:\n${failures.join("\n")}`);
  assert.equal(passed, total, rateLine);
});
