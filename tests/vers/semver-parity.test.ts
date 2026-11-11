import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { parseVers, validateVersVersions, versContains, VersError, versionScheme } from "../../src/vers.js";

const SEMVER_SCHEMES = new Set(["semver", "npm", "cargo", "golang", "composer"]);

test("SemVer-family schemes agree on Go, Composer, Cargo, and npm loose forms", () => {
  const equivalentGroups = [
    ["1", "1.0", "1.0.0", "v1", "v1.0.0", "01.00.00", "=1.0.0", "=v1.0.0", " 1.0.0 "],
    ["1.2", "v1.2", "1.2.0", "v1.2.0+incompatible"],
    ["v1.2-rc.1", "1.2.0-rc.1+build.42"],
    ["1.2.3alpha1", "1.2.3-alpha1", "1.2.3-alpha1+meta"],
    ["1.2.3-01", "1.2.3-1"],
    ["1.2.3-", "1.2.3--"],
  ];

  // Ascending across Go pseudo-versions, pre-releases, short forms, and safe numeric upper bounds.
  const ordered = [
    "v0.0.0-20191109021931-daa7c04131f5",
    "v0.0.0-20210101000000-abcdef123456",
    "0.1.0-alpha.0",
    "0.1.0-alpha.1",
    "0.1.0",
    "1.0.0-9",
    "1.0.0-10",
    "1.0.0-alpha",
    "1.0.0",
    "1.2-dev",
    "1.2",
    "v2.0.0+incompatible",
    "2.0.1",
    "9007199254740991.0.0",
  ];

  for (const name of SEMVER_SCHEMES) {
    const scheme = versionScheme(name);
    for (const group of equivalentGroups) {
      const canonical = group[0]!;
      for (const variant of group) {
        assert.equal(scheme.compare(variant, canonical), 0, `${name}: ${variant} == ${canonical}`);
        assert.equal(scheme.compare(canonical, variant), 0, `${name}: ${canonical} == ${variant}`);
      }
    }
    assert.deepEqual(
      [...ordered].reverse().sort((left, right) => scheme.compare(left, right)),
      ordered,
      `${name}: total order mismatch`,
    );
    for (const invalid of [
      "",
      "V1.2.3",
      "1.2.3+",
      "1.2.3-.",
      "1.2.3-a..b",
      "1.2.3.4",
      "9007199254740992.0.0",
      "latest",
    ]) {
      assert.throws(() => scheme.compare(invalid, "1.0.0"), VersError, `${name}: expected invalid ${invalid}`);
    }
  }
});

test("every SemVer-family rule in registry/ validates and enforces constraint boundaries", async () => {
  const registryDir = resolve("registry");
  const files = (await readdir(registryDir))
    .filter((file) => file.endsWith(".json") && file !== "github-actions-shas.json")
    .sort();

  let checkedRules = 0;
  for (const file of files) {
    const content = JSON.parse(await readFile(join(registryDir, file), "utf8")) as {
      rules?: Array<{ id: string; vers: string }>;
    };
    for (const rule of content.rules ?? []) {
      const range = parseVers(rule.vers);
      if (!SEMVER_SCHEMES.has(range.scheme)) continue;
      checkedRules++;
      validateVersVersions(range);

      if (range.all) {
        assert.equal(versContains(range, "0.0.0"), true, rule.id);
        continue;
      }
      for (const constraint of range.constraints) {
        if (constraint.comparator === "!=") {
          assert.equal(versContains(range, constraint.version), false, `${rule.id}: excludes != ${constraint.version}`);
        } else if (constraint.comparator === "=" || constraint.comparator === "<=" || constraint.comparator === ">=") {
          assert.equal(
            versContains(range, constraint.version),
            true,
            `${rule.id}: includes ${constraint.comparator} ${constraint.version}`,
          );
        } else if (range.constraints.every((other) => other === constraint || other.comparator !== "=")) {
          assert.equal(
            versContains(range, constraint.version),
            false,
            `${rule.id}: excludes strict bound ${constraint.comparator} ${constraint.version}`,
          );
        }
      }
    }
  }
  assert.ok(checkedRules >= 500, `expected >= 500 semver-family rules, checked ${checkedRules}`);
});
