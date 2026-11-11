import assert from "node:assert/strict";
import { appendFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { hasVersionScheme, normalizeVers, parseVers, versContains, versionScheme } from "../../src/vers/index.js";

// Compiled under dist/tests/vers/; reach the source tree the same way tests/purl/spec.test.ts does.
const fixturesRoot = fileURLToPath(new URL("../../../tests/vers/fixtures", import.meta.url));
const knownFailuresPath = fileURLToPath(new URL("../../../tests/vers/known-failures.json", import.meta.url));

type TestType = "parse" | "validate" | "containment" | "comparison" | "equality" | "from_native";
type TestGroup = "required" | "recommended";

interface RangeInput {
  scheme?: string;
  input_scheme?: string;
  input_type?: string;
  vers?: string;
  version?: string;
  versions?: string[];
}

interface FixtureCase {
  description: string;
  test_group: TestGroup;
  test_type: TestType;
  input: string | RangeInput;
  expected_output?: unknown;
  expected_failure?: boolean;
  expected_message?: string;
}

interface FixtureFile {
  tests: FixtureCase[];
}

interface KnownFailure {
  name: string;
  reason: string;
}

function schemeOf(tc: FixtureCase): string | undefined {
  if (typeof tc.input === "string") {
    return /^vers:([^/]+)\//.exec(tc.input)?.[1]?.toLowerCase();
  }
  if (tc.input.vers) {
    return /^vers:([^/]+)\//.exec(tc.input.vers)?.[1]?.toLowerCase();
  }
  return (tc.input.input_scheme ?? tc.input.input_type ?? tc.input.scheme)?.toLowerCase();
}

function runCase(tc: FixtureCase, scheme: string): boolean {
  try {
    if (tc.test_type === "parse") {
      assert.equal(typeof tc.input, "string");
      const input = tc.input as string;
      const parsed = tc.test_group === "recommended" ? parseVers(normalizeVers(input)) : parseVers(input);
      if (tc.expected_failure) return false;
      const actual = {
        type: parsed.scheme,
        constraints: parsed.constraints.map(({ comparator, version }) => [comparator, version]),
      };
      return JSON.stringify(actual) === JSON.stringify(tc.expected_output);
    }

    if (tc.test_type === "validate") {
      assert.equal(typeof tc.input, "string");
      const canonical = normalizeVers(tc.input as string);
      if (tc.expected_failure) return false;
      return canonical === tc.expected_output;
    }

    if (tc.test_type === "containment") {
      assert.equal(typeof tc.input, "object");
      const input = tc.input as RangeInput;
      assert.ok(input.vers !== undefined && input.version !== undefined);
      const contained = versContains(input.vers, input.version);
      if (tc.expected_failure) return false;
      return contained === tc.expected_output;
    }

    if (tc.test_type === "equality") {
      const [left, right] = (tc.input as RangeInput).versions ?? [];
      assert.ok(left !== undefined && right !== undefined);
      const equal = versionScheme(scheme).compare(left, right) === 0;
      if (tc.expected_failure) return false;
      return equal === tc.expected_output;
    }

    if (tc.test_type === "comparison") {
      const versions = (tc.input as RangeInput).versions ?? [];
      const comparator = versionScheme(scheme);
      const sorted = [...versions].sort((left, right) => comparator.compare(left, right));
      if (tc.expected_failure) return false;
      return JSON.stringify(sorted) === JSON.stringify(tc.expected_output);
    }
  } catch (error) {
    if (!tc.expected_failure) return false;
    if (!tc.expected_message) return true;
    return error instanceof Error && error.message.includes(tc.expected_message);
  }

  return false;
}

test("official vers-spec suite (supported schemes)", async () => {
  const knownList = JSON.parse(await readFile(knownFailuresPath, "utf8")) as KnownFailure[];
  const known = new Map(knownList.map((entry) => [entry.name, entry]));
  const seen = new Set<string>();
  const unexpectedFailures: string[] = [];
  const unexpectedlyPassing: string[] = [];

  let total = 0;
  let passed = 0;
  let unsupportedSkipped = 0;
  let fromNativeSkipped = 0;

  const files = (await readdir(fixturesRoot)).filter((name) => name.endsWith(".json")).sort();
  for (const file of files) {
    const suite = JSON.parse(await readFile(join(fixturesRoot, file), "utf8")) as FixtureFile;
    for (const [index, tc] of suite.tests.entries()) {
      const name = `${file}[${index}]:${tc.test_type}`;
      assert.ok(!seen.has(name), `duplicate case name: ${name}`);
      seen.add(name);

      if (tc.test_type === "from_native") {
        fromNativeSkipped += 1;
        continue;
      }

      const scheme = schemeOf(tc);
      if (!scheme || !hasVersionScheme(scheme)) {
        unsupportedSkipped += 1;
        continue;
      }

      total += 1;
      const ok = runCase(tc, scheme);
      if (known.has(name)) {
        if (ok) unexpectedlyPassing.push(name);
      } else if (ok) {
        passed += 1;
      } else {
        unexpectedFailures.push(name);
      }
    }
  }

  for (const name of known.keys()) {
    assert.ok(seen.has(name), `known-failures.json lists unknown case: ${name}`);
  }

  const rateLine = `vers-spec pass rate: ${passed}/${total}`;
  assert.match(rateLine, /^vers-spec pass rate: \d+\/\d+$/);
  console.log(
    `${rateLine} (${knownList.length} known failures; skipped ${unsupportedSkipped} unsupported-scheme, ${fromNativeSkipped} from_native)`,
  );

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await appendFile(
      summaryPath,
      `## ${rateLine}\n\nSupported schemes: ${passed}/${total} (${knownList.length} known failures; skipped ${unsupportedSkipped} unsupported-scheme, ${fromNativeSkipped} \`from_native\` vectors).\n\n`,
      "utf8",
    );
  }

  assert.deepEqual(
    unexpectedlyPassing,
    [],
    `cases in known-failures.json now pass; remove them:\n${unexpectedlyPassing.join("\n")}`,
  );
  assert.deepEqual(unexpectedFailures, [], `vers-spec cases failed unexpectedly:\n${unexpectedFailures.join("\n")}`);
  assert.equal(passed + knownList.length, total, rateLine);
});
