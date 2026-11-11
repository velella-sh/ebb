import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { formatVers, hasVersionScheme, normalizeVers, parseVers } from "../../src/vers/index.js";

// Compiled under dist/tests/vers/; reach the source tree the same way spec.test.ts does.
const fixturesRoot = fileURLToPath(new URL("../../../tests/vers/fixtures", import.meta.url));
const upstreamInconsistenciesPath = fileURLToPath(
  new URL("../../../tests/vers/upstream-inconsistencies.json", import.meta.url),
);

type TestType = "parse" | "validate" | "containment" | "comparison" | "equality" | "from_native";

interface FixtureCase {
  test_type: TestType;
  test_group: "required" | "recommended";
  input: string | { vers?: string };
  expected_output?: unknown;
  expected_failure?: boolean;
}

interface FixtureFile {
  tests: FixtureCase[];
}

interface UpstreamInconsistency {
  name: string;
  kind: string;
}

/** Valid VERS strings carried by non-`from_native` fixture cases. */
function versStringsFromCase(tc: FixtureCase): string[] {
  if (tc.expected_failure || tc.test_type === "from_native") return [];
  if ((tc.test_type === "parse" || tc.test_type === "validate") && typeof tc.input === "string") {
    const strings = [tc.input];
    if (tc.test_type === "validate" && typeof tc.expected_output === "string") {
      strings.push(tc.expected_output);
    }
    return strings;
  }
  if (tc.test_type === "containment" && typeof tc.input === "object" && typeof tc.input.vers === "string") {
    return [tc.input.vers];
  }
  return [];
}

function schemeOf(vers: string): string | undefined {
  return /^vers:([^/]+)\//i.exec(vers)?.[1]?.toLowerCase();
}

test("valid vers-spec fixtures round-trip canonically through formatVers", async () => {
  const invalidClause54 = new Set(
    (JSON.parse(await readFile(upstreamInconsistenciesPath, "utf8")) as UpstreamInconsistency[])
      .filter((entry) => entry.kind === "clause-5.4-invalid-range")
      .map((entry) => entry.name),
  );
  const seen = new Set<string>();
  const roundTripMismatches: string[] = [];
  const notCanonical: string[] = [];
  let covered = 0;

  const files = (await readdir(fixturesRoot)).filter((name) => name.endsWith(".json")).sort();
  for (const file of files) {
    const suite = JSON.parse(await readFile(join(fixturesRoot, file), "utf8")) as FixtureFile;
    for (const [index, tc] of suite.tests.entries()) {
      const caseName = `${file}[${index}]:${tc.test_type}`;
      if (invalidClause54.has(caseName)) continue;

      for (const vers of versStringsFromCase(tc)) {
        const scheme = schemeOf(vers);
        if (!scheme || !hasVersionScheme(scheme)) continue;

        if (tc.test_type === "parse" && tc.test_group === "required" && formatVers(parseVers(vers)) !== vers) {
          notCanonical.push(`${caseName} required input changed: ${vers}`);
        }
        if (seen.has(vers)) continue;
        seen.add(vers);

        const first = parseVers(normalizeVers(vers));
        covered += 1;
        const written = formatVers(first);
        const second = parseVers(written);
        if (JSON.stringify(first) !== JSON.stringify(second)) {
          roundTripMismatches.push(`${caseName} ${vers} -> ${written}`);
          continue;
        }
        const rewritten = formatVers(second);
        if (rewritten !== written) {
          notCanonical.push(`${caseName} ${written} -> ${rewritten}`);
        }
      }
    }
  }

  assert.equal(covered, seen.size, "covered count must equal unique valid fixture strings");
  assert.equal(covered, 30, `expected 30 unique valid fixture strings, covered ${covered}`);
  assert.deepEqual(
    roundTripMismatches,
    [],
    `parse → formatVers → parse mismatches:\n${roundTripMismatches.join("\n")}`,
  );
  assert.deepEqual(notCanonical, [], `formatVers output was not canonical:\n${notCanonical.join("\n")}`);
});
