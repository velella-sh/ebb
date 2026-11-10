import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { formatPurl, parsePurl, type PackageUrl } from "../../src/purl.js";

// Compiled under dist/tests/purl/; reach the source tree the same way the suite does.
const fixturesRoot = fileURLToPath(new URL("../../../tests/purl/fixtures", import.meta.url));

type TestType = "parse" | "build" | "validate";

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
  test_group: string;
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

/** Qualifiers are a map; key order must not count as a difference. */
function comparable(parsed: PackageUrl): unknown {
  const qualifiers = parsed.qualifiers;
  const sorted =
    qualifiers == null
      ? undefined
      : Object.fromEntries(
          Object.keys(qualifiers)
            .sort()
            .map((key) => [key, qualifiers[key]]),
        );
  return {
    type: parsed.type,
    namespace: parsed.namespace,
    name: parsed.name,
    version: parsed.version,
    qualifiers: sorted,
    subpath: parsed.subpath,
  };
}

/**
 * Every successful fixture yields a PURL string we can round-trip:
 * parse/validate inputs, and build expected outputs.
 */
function purlStringsFromCase(tc: FixtureCase): string[] {
  if (tc.expected_failure) return [];
  if ((tc.test_type === "parse" || tc.test_type === "validate") && typeof tc.input === "string") {
    return [tc.input];
  }
  if (tc.test_type === "build" && typeof tc.expected_output === "string") {
    return [tc.expected_output];
  }
  return [];
}

test("valid purl-spec fixtures round-trip through formatPurl", async () => {
  const seen = new Set<string>();
  const roundTripMismatches: string[] = [];
  const notCanonical: string[] = [];
  let covered = 0;

  for await (const path of walkJson(fixturesRoot)) {
    const suite = JSON.parse(await readFile(path, "utf8")) as FixtureFile;
    const suiteRel = relative(fixturesRoot, path).replaceAll("\\", "/");
    for (const [index, tc] of suite.tests.entries()) {
      for (const purl of purlStringsFromCase(tc)) {
        if (seen.has(purl)) continue;
        seen.add(purl);

        let first: PackageUrl;
        try {
          first = parsePurl(purl);
        } catch {
          // Non-canonical recommended inputs fail strict parse; skip those strings.
          continue;
        }

        covered += 1;
        const written = formatPurl(first);
        const second = parsePurl(written);
        if (JSON.stringify(comparable(first)) !== JSON.stringify(comparable(second))) {
          roundTripMismatches.push(`${suiteRel}[${index}] ${purl} -> ${written}`);
          continue;
        }

        const rewritten = formatPurl(second);
        if (rewritten !== written) {
          notCanonical.push(`${suiteRel}[${index}] ${written} -> ${rewritten}`);
        }
      }
    }
  }

  assert.ok(covered > 0, "expected at least one valid fixture to round-trip");
  assert.deepEqual(roundTripMismatches, [], `parse → format → parse mismatches:\n${roundTripMismatches.join("\n")}`);
  assert.deepEqual(notCanonical, [], `formatPurl output was not canonical:\n${notCanonical.join("\n")}`);
});
